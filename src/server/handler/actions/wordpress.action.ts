'use server';

import { cookies } from 'next/headers';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';
import { WordPressSettings } from '@/types/wordpress';
import { WordPressService, WordPressAuth } from '@/server/services/wordpressService';

const supabaseService = new SupabaseService();

/**
 * WordPress設定を取得
 */
export async function getWordPressSettings(): Promise<WordPressSettings | null> {
  const cookieStore = await cookies();

  // 認証情報はCookieから取得（セキュリティベストプラクティス）
  const liffAccessToken = cookieStore.get('line_access_token')?.value;
  const refreshToken = cookieStore.get('line_refresh_token')?.value;

  if (!liffAccessToken) {
    throw new Error('認証情報が見つかりません');
  }

  const authResult = await authMiddleware(liffAccessToken, refreshToken);

  if (authResult.error || !authResult.userId) {
    throw new Error('認証に失敗しました');
  }

  return await supabaseService.getWordPressSettingsByUserId(authResult.userId);
}

// ==========================================
// WordPress 投稿一覧取得（現在ユーザー）
// ==========================================

type WpPostTitle = { rendered?: string } | string | undefined;
type WpPostExcerpt = { rendered?: string } | string | undefined;

interface WpRestTerm {
  id?: number;
  name?: string;
}

interface WpRestPost {
  id?: number;
  ID?: number;
  date?: string;
  modified?: string;
  title?: WpPostTitle;
  link?: string;
  categories?: number[];
  excerpt?: WpPostExcerpt;
  yoast_head_json?: {
    canonical?: string;
  };
  _embedded?: {
    'wp:term'?: Array<Array<WpRestTerm>>;
  };
}

// ==========================================
// ヘルパー型
// ==========================================
type NormalizedPost = {
  id: number;
  date?: string;
  title?: string;
  link?: string;
  canonical_url?: string;
  categories?: number[];
  categoryNames?: string[];
  excerpt?: string;
};

type RestRequestConfig = {
  headers: Record<string, string>;
  candidates: string[];
  siteUrlClean: string;
  isSelfHosted: boolean;
  error?: string;
};

// ==========================================
// ヘルパー関数
// ==========================================
function buildCommonHeaders(): Record<string, string> {
  return {
    Accept: 'application/json',
    'User-Agent': 'IndustrySpecificMC/1.0 (+app)',
  };
}

async function getRestRequestConfig(
  wpSettings: WordPressSettings,
  getCookie: (name: string) => string | undefined,
  page: number,
  perPage: number
): Promise<RestRequestConfig> {
  const commonHeaders = buildCommonHeaders();
  let headers: Record<string, string> = {};
  let candidates: string[] = [];

  if (wpSettings.wpType === 'wordpress_com') {
    const baseUrl = `https://public-api.wordpress.com/wp/v2/sites/${wpSettings.wpSiteId || ''}`;
    const tokenCookieName = process.env.OAUTH_TOKEN_COOKIE_NAME || 'wpcom_oauth_token';
    const accessToken = getCookie(tokenCookieName) || '';
    if (!accessToken) {
      return {
        headers: {},
        candidates: [],
        siteUrlClean: '',
        isSelfHosted: false,
        error: 'WordPress.comのアクセストークンが見つかりません（OAuth連携が必要です）',
      };
    }
    headers = { ...commonHeaders, Authorization: `Bearer ${accessToken}` };
    candidates = [
      `${baseUrl}/posts?_embed=true&per_page=${perPage}&page=${page}`,
      `${baseUrl}/posts?per_page=${perPage}&page=${page}`,
    ];
    return { headers, candidates, siteUrlClean: '', isSelfHosted: false };
  }

  // セルフホスト
  const siteUrlClean = (wpSettings.wpSiteUrl || '').replace(/\/$/, '');
  const username = wpSettings.wpUsername || '';
  const appPass = wpSettings.wpApplicationPassword || '';
  const credentials = Buffer.from(`${username}:${appPass}`).toString('base64');
  headers = { ...commonHeaders, Authorization: `Basic ${credentials}` };
  candidates = [
    `${siteUrlClean}/wp-json/wp/v2/posts?_embed=true&per_page=${perPage}&page=${page}`,
    `${siteUrlClean}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}`,
    `${siteUrlClean}/index.php?rest_route=/wp/v2/posts&_embed=true&per_page=${perPage}&page=${page}`,
    `${siteUrlClean}/index.php?rest_route=/wp/v2/posts&per_page=${perPage}&page=${page}`,
  ];
  return { headers, candidates, siteUrlClean, isSelfHosted: true };
}

async function tryFetchCandidates(
  candidates: string[],
  headers: Record<string, string>
): Promise<{ resp: Response | null; lastStatus: number; lastErrorText: string }> {
  let resp: Response | null = null;
  let lastStatus = 0;
  let lastErrorText = '';
  for (const url of candidates) {
    try {
      const r = await fetch(url, { headers, cache: 'no-store' });
      if (r.ok) {
        resp = r;
        break;
      }
      lastStatus = r.status;
      lastErrorText = await r.text().catch(() => r.statusText);
      console.error('[WP posts] Fetch failed candidate', {
        url,
        status: r.status,
        txt: lastErrorText,
      });
    } catch (e) {
      lastErrorText = e instanceof Error ? e.message : 'Unknown fetch error';
      console.error('[WP posts] Fetch exception candidate', { url, error: lastErrorText });
    }
  }
  return { resp, lastStatus, lastErrorText };
}

async function parseRssAndNormalize(
  siteUrlClean: string,
  page: number,
  perPage: number
): Promise<{ normalized: NormalizedPost[]; total: number } | null> {
  const rssCandidates = [`${siteUrlClean}/feed/`, `${siteUrlClean}/?feed=rss2`];
  for (const rssUrl of rssCandidates) {
    try {
      const rssHeaders: HeadersInit = {
        'User-Agent': 'IndustrySpecificMC/1.0 (+app)',
        Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
      };
      const rssResp = await fetch(rssUrl, { headers: rssHeaders, cache: 'no-store' });
      if (!rssResp.ok) {
        const lastStatus = rssResp.status;
        const lastErrorText = await rssResp.text().catch(() => rssResp.statusText);
        console.error('[WP posts] RSS fetch failed candidate', {
          url: rssUrl,
          status: lastStatus,
          txt: lastErrorText,
        });
        continue;
      }
      const xml = await rssResp.text();

      const items: Array<{
        title?: string;
        link?: string;
        pubDate?: string;
        description?: string;
        categories?: string[];
      }> = [];

      const itemRegex = /<item[\s\S]*?<\/item>/g;
      const titleRegex = /<title>([\s\S]*?)<\/title>/i;
      const linkRegex = /<link>([\s\S]*?)<\/link>/i;
      const pubDateRegex = /<pubDate>([\s\S]*?)<\/pubDate>/i;
      const descRegex = /<description>([\s\S]*?)<\/description>/i;
      const catRegex = /<category[^>]*>([\s\S]*?)<\/category>/gi;

      const decodeCdata = (v: string) =>
        v
          .replace(/^\s*<!\[CDATA\[/, '')
          .replace(/\]\]>\s*$/, '')
          .trim();
      const stripTags = (v: string) => v.replace(/<[^>]+>/g, '').trim();

      const matches = xml.match(itemRegex) || [];
      for (const raw of matches) {
        const titleMatch = titleRegex.exec(raw)?.[1];
        const linkMatch = linkRegex.exec(raw)?.[1];
        const pubDateMatch = pubDateRegex.exec(raw)?.[1];
        const descriptionMatch = descRegex.exec(raw)?.[1];
        const cats: string[] = [];
        let m: RegExpExecArray | null;
        while ((m = catRegex.exec(raw)) !== null) {
          if (m[1]) cats.push(stripTags(decodeCdata(m[1])));
        }
        const item: {
          title?: string;
          link?: string;
          pubDate?: string;
          description?: string;
          categories?: string[];
        } = {};
        if (titleMatch) item.title = stripTags(decodeCdata(titleMatch));
        if (linkMatch) item.link = linkMatch.trim();
        if (pubDateMatch) item.pubDate = pubDateMatch.trim();
        if (descriptionMatch) item.description = stripTags(decodeCdata(descriptionMatch));
        if (cats.length > 0) item.categories = cats;
        items.push(item);
      }

      const start = (page - 1) * perPage;
      const end = start + perPage;
      const sliced = items.slice(start, end);

      const normalized = sliced.map((it, idx) => {
        const n: NormalizedPost = { id: (start + idx + 1) as number };
        if (it.pubDate) n.date = it.pubDate;
        if (it.title) n.title = it.title;
        if (it.link) {
          n.link = it.link;
          n.canonical_url = it.link;
        }
        n.categoryNames = it.categories || [];
        if (it.description) n.excerpt = it.description;
        return n;
      });

      return { normalized, total: items.length };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown RSS fetch error';
      console.error('[WP posts] RSS exception candidate', { url: rssUrl, error: msg });
      continue;
    }
  }
  return null;
}

function normalizeFromRest(posts: WpRestPost[]): NormalizedPost[] {
  return posts.map(p => {
    const termsNested = p._embedded?.['wp:term'] ?? [];
    const firstTaxonomy =
      Array.isArray(termsNested) && termsNested.length > 0 ? termsNested[0] : [];
    const categoryNames = (firstTaxonomy || [])
      .filter((t: WpRestTerm) => Boolean(t && t.name))
      .map((t: WpRestTerm) => t.name as string);

    const renderedTitle = typeof p.title === 'string' ? p.title : p.title?.rendered;
    const renderedExcerpt = typeof p.excerpt === 'string' ? p.excerpt : p.excerpt?.rendered;

    const canonicalFromYoast = p.yoast_head_json?.canonical;
    return {
      id: (p.id ?? p.ID) as number,
      date: p.date ?? p.modified,
      title: renderedTitle,
      link: p.link,
      canonical_url: canonicalFromYoast ?? p.link,
      categories: p.categories,
      categoryNames,
      excerpt: renderedExcerpt,
    } as NormalizedPost;
  });
}

export async function getWordPressPostsForCurrentUser(page: number, perPage: number) {
  const cookieStore = await cookies();

  const liffAccessToken = cookieStore.get('line_access_token')?.value;
  const refreshToken = cookieStore.get('line_refresh_token')?.value;

  const authResult = await authMiddleware(liffAccessToken, refreshToken);
  if (authResult.error || !authResult.userId) {
    return { success: false as const, error: 'ユーザー認証に失敗しました' };
  }

  const wpSettings = await supabaseService.getWordPressSettingsByUserId(authResult.userId);

  if (!wpSettings) {
    return { success: true as const, data: { posts: [], total: 0 } };
  }

  const getCookie = (name: string) => cookieStore.get(name)?.value;
  const rest = await getRestRequestConfig(wpSettings, getCookie, page, perPage);
  if (rest.error) {
    return { success: false as const, error: rest.error };
  }

  const { resp, lastStatus, lastErrorText } = await tryFetchCandidates(
    rest.candidates,
    rest.headers
  );

  if (!resp) {
    if (rest.isSelfHosted && rest.siteUrlClean) {
      const rss = await parseRssAndNormalize(rest.siteUrlClean, page, perPage);
      if (rss) {
        return { success: true as const, data: { posts: rss.normalized, total: rss.total } };
      }
    }
    return {
      success: false as const,
      error: `WordPress投稿取得エラー: HTTP ${lastStatus} ${lastErrorText}`,
    };
  }

  const postsJson: unknown = await resp.json();
  const headerTotal = parseInt(resp.headers.get('X-WP-Total') || '0', 10);
  const total =
    Number.isFinite(headerTotal) && headerTotal > 0
      ? headerTotal
      : Array.isArray(postsJson)
        ? (postsJson as unknown[]).length
        : 0;
  const posts: WpRestPost[] = Array.isArray(postsJson) ? (postsJson as WpRestPost[]) : [];
  const normalized = normalizeFromRest(posts);

  return { success: true as const, data: { posts: normalized, total } };
}

// ==========================================
// Annotations (ユーザー入力) CRUD
// ==========================================

export type ContentAnnotationPayload = {
  wp_post_id: number;
  canonical_url?: string | null;
  main_kw?: string | null;
  kw?: string | null;
  impressions?: string | null;
  persona?: string | null; // デモグラ・ペルソナ
  needs?: string | null; // ニーズ
  goal?: string | null; // ゴール
  prep?: string | null; // PREP構成メモ
  basic_structure?: string | null; // 基本構成メモ
  opening_proposal?: string | null; // 書き出し案メモ
};

export async function upsertContentAnnotation(payload: ContentAnnotationPayload) {
  const cookieStore = await cookies();
  const liffAccessToken = cookieStore.get('line_access_token')?.value;
  const refreshToken = cookieStore.get('line_refresh_token')?.value;
  const authResult = await authMiddleware(liffAccessToken, refreshToken);
  if (authResult.error || !authResult.userId) {
    return { success: false as const, error: 'ユーザー認証に失敗しました' };
  }

  const supabaseServiceLocal = new SupabaseService();
  const client = supabaseServiceLocal.getClient();

  const { error } = await client.from('content_annotations').upsert(
    {
      user_id: authResult.userId,
      wp_post_id: payload.wp_post_id,
      canonical_url: payload.canonical_url ?? null,
      main_kw: payload.main_kw ?? null,
      kw: payload.kw ?? null,
      impressions: payload.impressions ?? null,
      persona: payload.persona ?? null,
      needs: payload.needs ?? null,
      goal: payload.goal ?? null,
      prep: payload.prep ?? null,
      basic_structure: payload.basic_structure ?? null,
      opening_proposal: payload.opening_proposal ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,wp_post_id' }
  );

  if (error) {
    return { success: false as const, error: error.message };
  }

  return { success: true as const };
}

export async function getContentAnnotationsForUser() {
  const cookieStore = await cookies();
  const liffAccessToken = cookieStore.get('line_access_token')?.value;
  const refreshToken = cookieStore.get('line_refresh_token')?.value;
  const authResult = await authMiddleware(liffAccessToken, refreshToken);
  if (authResult.error || !authResult.userId) {
    return { success: false as const, error: 'ユーザー認証に失敗しました' };
  }

  const client = new SupabaseService().getClient();
  const { data, error } = await client
    .from('content_annotations')
    .select('*')
    .eq('user_id', authResult.userId);

  if (error) return { success: false as const, error: error.message };
  return { success: true as const, data };
}

// ==========================================
// WordPress 設定の保存（サーバーアクション）
// ==========================================

export async function saveWordPressSettingsAction(params: {
  wpType: 'wordpress_com' | 'self_hosted';
  wpSiteId?: string;
  wpSiteUrl?: string;
  wpUsername?: string;
  wpApplicationPassword?: string;
}) {
  const cookieStore = await cookies();
  try {
    const { wpType, wpSiteId, wpSiteUrl, wpUsername, wpApplicationPassword } = params;

    // 認証情報はCookieから取得（セキュリティベストプラクティス）
    const liffToken = cookieStore.get('line_access_token')?.value;
    const refreshToken = cookieStore.get('line_refresh_token')?.value;

    if (!liffToken || !wpType) {
      return { success: false as const, error: 'Authentication required or required fields missing' };
    }

    const authResult = await authMiddleware(liffToken, refreshToken);
    if (authResult.error || !authResult.userId) {
      return { success: false as const, error: 'Authentication failed' };
    }

    if (wpType === 'self_hosted') {
      if (!wpSiteUrl || !wpUsername || !wpApplicationPassword) {
        return {
          success: false as const,
          error: 'Self-hosted WordPress requires site URL, username, and application password',
        };
      }

      await supabaseService.createOrUpdateSelfHostedWordPressSettings(
        authResult.userId,
        wpSiteUrl,
        wpUsername,
        wpApplicationPassword
      );
    } else if (wpType === 'wordpress_com') {
      if (!wpSiteId) {
        return { success: false as const, error: 'WordPress.com requires site ID' };
      }

      await supabaseService.createOrUpdateWordPressSettings(authResult.userId, '', '', wpSiteId);
    }

    return { success: true as const, message: 'WordPress settings saved successfully' };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ==========================================
// WordPress 接続テスト（サーバーアクション）
// 保存済み設定を用いて接続を確認する
// ==========================================

export async function testWordPressConnectionAction() {
  const cookieStore = await cookies();
  try {
    // 認証情報はCookieから取得（セキュリティベストプラクティス）
    const liffToken = cookieStore.get('line_access_token')?.value;
    const refreshToken = cookieStore.get('line_refresh_token')?.value;

    if (!liffToken) {
      return { success: false as const, error: 'LINE認証が必要です' };
    }

    const authResult = await authMiddleware(liffToken, refreshToken);
    if (authResult.error || !authResult.userId) {
      return { success: false as const, error: 'ユーザー認証に失敗しました' };
    }

    const wpSettings = await supabaseService.getWordPressSettingsByUserId(authResult.userId);
    if (!wpSettings) {
      return { success: false as const, error: 'WordPress設定が登録されていません' };
    }

    let wordpressService: WordPressService;

    if (wpSettings.wpType === 'wordpress_com') {
      const tokenCookieName = process.env.OAUTH_TOKEN_COOKIE_NAME || 'wpcom_oauth_token';
      const accessToken = cookieStore.get(tokenCookieName)?.value;
      if (!accessToken) {
        return {
          success: false as const,
          error: 'WordPress.comのアクセストークンが見つかりません。連携を行ってください。',
          needsWordPressAuth: true,
        } as const;
      }

      const auth: WordPressAuth = {
        type: 'wordpress_com',
        wpComAuth: {
          accessToken,
          siteId: wpSettings.wpSiteId || '',
        },
      };
      wordpressService = new WordPressService(auth);
    } else {
      const auth: WordPressAuth = {
        type: 'self_hosted',
        selfHostedAuth: {
          siteUrl: wpSettings.wpSiteUrl || '',
          username: wpSettings.wpUsername || '',
          applicationPassword: wpSettings.wpApplicationPassword || '',
        },
      };
      wordpressService = new WordPressService(auth);
    }

    const connectionTest = await wordpressService.testConnection();
    if (!connectionTest.success) {
      return {
        success: false as const,
        error:
          connectionTest.error ||
          `${wpSettings.wpType === 'wordpress_com' ? 'WordPress.com' : 'セルフホストWordPress'}への接続テストに失敗しました。`,
      };
    }

    return {
      success: true as const,
      message: `${wpSettings.wpType === 'wordpress_com' ? 'WordPress.com' : 'セルフホストWordPress'}接続テストが成功しました`,
      siteInfo: connectionTest.data,
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : '接続テスト中に予期せぬエラーが発生しました',
    };
  }
}

// ==========================================
// セッション基盤の保存/取得/公開機能
// ==========================================

export async function getContentAnnotationBySession(session_id: string) {
  const cookieStore = await cookies();
  const liffAccessToken = cookieStore.get('line_access_token')?.value;
  const refreshToken = cookieStore.get('line_refresh_token')?.value;
  const authResult = await authMiddleware(liffAccessToken, refreshToken);
  if (authResult.error || !authResult.userId)
    return { success: false as const, error: 'ユーザー認証に失敗しました' };

  const client = new SupabaseService().getClient();
  const { data, error } = await client
    .from('content_annotations')
    .select('*')
    .eq('user_id', authResult.userId)
    .eq('session_id', session_id)
    .maybeSingle();

  if (error) return { success: false as const, error: error.message };
  return { success: true as const, data };
}

export async function upsertContentAnnotationBySession(payload: {
  session_id: string;
  main_kw?: string | null;
  kw?: string | null;
  impressions?: string | null;
  persona?: string | null;
  needs?: string | null;
  goal?: string | null;
  prep?: string | null;
  basic_structure?: string | null;
  opening_proposal?: string | null;
  wp_post_id?: number | null;
}) {
  const cookieStore = await cookies();
  const liffAccessToken = cookieStore.get('line_access_token')?.value;
  const refreshToken = cookieStore.get('line_refresh_token')?.value;
  const authResult = await authMiddleware(liffAccessToken, refreshToken);
  if (authResult.error || !authResult.userId)
    return { success: false as const, error: 'ユーザー認証に失敗しました' };

  const client = new SupabaseService().getClient();
  const upsertPayload: Record<string, unknown> = {
    user_id: authResult.userId,
    session_id: payload.session_id,
    main_kw: payload.main_kw ?? null,
    kw: payload.kw ?? null,
    impressions: payload.impressions ?? null,
    persona: payload.persona ?? null,
    needs: payload.needs ?? null,
    goal: payload.goal ?? null,
    prep: payload.prep ?? null,
    basic_structure: payload.basic_structure ?? null,
    opening_proposal: payload.opening_proposal ?? null,
    updated_at: new Date().toISOString(),
  };

  if (Object.prototype.hasOwnProperty.call(payload, 'wp_post_id')) {
    upsertPayload.wp_post_id = payload.wp_post_id ?? null;
  }

  const { error } = await client
    .from('content_annotations')
    .upsert(upsertPayload, { onConflict: 'user_id,session_id' });

  if (error) return { success: false as const, error: error.message };
  return { success: true as const };
}
