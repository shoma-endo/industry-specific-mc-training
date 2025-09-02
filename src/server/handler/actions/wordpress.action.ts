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
export async function getWordPressSettings(
  liffAccessToken: string
): Promise<WordPressSettings | null> {
  const refreshToken = ''; // 必要に応じてリフレッシュトークンを取得

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
  _embedded?: {
    'wp:term'?: Array<Array<WpRestTerm>>;
  };
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

  const commonHeaders: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'IndustrySpecificMC/1.0 (+app)',
  };

  let baseUrl: string;
  let headers: Record<string, string>;

  if (wpSettings.wpType === 'wordpress_com') {
    baseUrl = `https://public-api.wordpress.com/wp/v2/sites/${wpSettings.wpSiteId || ''}`;
    const tokenCookieName = process.env.OAUTH_TOKEN_COOKIE_NAME || 'wpcom_oauth_token';
    const accessToken = cookieStore.get(tokenCookieName)?.value || '';
    if (!accessToken) {
      console.error('[WP posts] Missing WordPress.com access token cookie', {
        tokenCookieName,
      });
      return {
        success: false as const,
        error: 'WordPress.comのアクセストークンが見つかりません（OAuth連携が必要です）',
      };
    }
    headers = { ...commonHeaders, Authorization: `Bearer ${accessToken}` };
  } else {
    const siteUrl = (wpSettings.wpSiteUrl || '').replace(/\/$/, '');
    baseUrl = `${siteUrl}/wp-json/wp/v2`;
    const username = wpSettings.wpUsername || '';
    const appPass = wpSettings.wpApplicationPassword || '';
    const credentials = Buffer.from(`${username}:${appPass}`).toString('base64');
    headers = { ...commonHeaders, Authorization: `Basic ${credentials}` };
  }

  // フォールバック戦略（主に self_hosted 向けのWAF/制限回避）
  const siteUrlClean = (wpSettings.wpSiteUrl || '').replace(/\/$/, '');
  const candidates: string[] =
    wpSettings.wpType === 'self_hosted'
      ? [
          `${siteUrlClean}/wp-json/wp/v2/posts?_embed=true&per_page=${perPage}&page=${page}`,
          `${siteUrlClean}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}`,
          `${siteUrlClean}/index.php?rest_route=/wp/v2/posts&_embed=true&per_page=${perPage}&page=${page}`,
          `${siteUrlClean}/index.php?rest_route=/wp/v2/posts&per_page=${perPage}&page=${page}`,
        ]
      : [
          `${baseUrl}/posts?_embed=true&per_page=${perPage}&page=${page}`,
          `${baseUrl}/posts?per_page=${perPage}&page=${page}`,
        ];

  let resp: Response | null = null;
  let lastErrorText = '';
  let lastStatus = 0;
  for (const url of candidates) {
    try {
      const r = await fetch(url, { headers, cache: 'no-store' });
      if (r.ok) {
        resp = r;
        baseUrl = url; // for logging/debug
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

  if (!resp) {
    // RSS フォールバック（self_hosted のみ）
    if (wpSettings.wpType === 'self_hosted' && siteUrlClean) {
      const rssCandidates = [`${siteUrlClean}/feed/`, `${siteUrlClean}/?feed=rss2`];

      for (const rssUrl of rssCandidates) {
        try {
          const rssHeaders: HeadersInit = {
            'User-Agent': 'IndustrySpecificMC/1.0 (+app)',
            Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
          };
          const rssResp = await fetch(rssUrl, { headers: rssHeaders, cache: 'no-store' });
          if (!rssResp.ok) {
            lastStatus = rssResp.status;
            lastErrorText = await rssResp.text().catch(() => rssResp.statusText);
            console.error('[WP posts] RSS fetch failed candidate', {
              url: rssUrl,
              status: lastStatus,
            });
            continue;
          }
          const xml = await rssResp.text();

          // 簡易RSSパース（依存追加なし）
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

          // ページング（RSSは全件返る前提）
          const start = (page - 1) * perPage;
          const end = start + perPage;
          const sliced = items.slice(start, end);

          const normalizedFromRss = sliced.map((it, idx) => ({
            id: (start + idx + 1) as number,
            date: it.pubDate,
            title: it.title,
            link: it.link,
            categories: undefined as number[] | undefined,
            categoryNames: it.categories || [],
            excerpt: it.description,
          }));

          return {
            success: true as const,
            data: { posts: normalizedFromRss, total: items.length },
          };
        } catch (e) {
          lastErrorText = e instanceof Error ? e.message : 'Unknown RSS fetch error';
          console.error('[WP posts] RSS exception candidate', {
            url: rssUrl,
            error: lastErrorText,
          });
          continue;
        }
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

  const normalized = posts.map(p => {
    const termsNested = p._embedded?.['wp:term'] ?? [];
    const firstTaxonomy =
      Array.isArray(termsNested) && termsNested.length > 0 ? termsNested[0] : [];
    const categoryNames = (firstTaxonomy || [])
      .filter((t: WpRestTerm) => Boolean(t && t.name))
      .map((t: WpRestTerm) => t.name as string);

    const renderedTitle = typeof p.title === 'string' ? p.title : p.title?.rendered;
    const renderedExcerpt = typeof p.excerpt === 'string' ? p.excerpt : p.excerpt?.rendered;

    return {
      id: (p.id ?? p.ID) as number,
      date: p.date ?? p.modified,
      title: renderedTitle,
      link: p.link,
      categories: p.categories,
      categoryNames,
      excerpt: renderedExcerpt,
    };
  });

  // ログは不要のため出力しない

  return { success: true as const, data: { posts: normalized, total } };
}

// ==========================================
// WordPress 設定の保存（サーバーアクション）
// ==========================================

export async function saveWordPressSettingsAction(params: {
  liffAccessToken: string;
  wpType: 'wordpress_com' | 'self_hosted';
  wpSiteId?: string;
  wpSiteUrl?: string;
  wpUsername?: string;
  wpApplicationPassword?: string;
}) {
  const cookieStore = await cookies();
  try {
    const { liffAccessToken, wpType, wpSiteId, wpSiteUrl, wpUsername, wpApplicationPassword } =
      params;

    if (!liffAccessToken || !wpType) {
      return { success: false as const, error: 'Required fields missing' };
    }

    const liffToken = cookieStore.get('line_access_token')?.value || liffAccessToken;
    const refreshToken = cookieStore.get('line_refresh_token')?.value;

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

export async function testWordPressConnectionAction(liffAccessToken: string) {
  const cookieStore = await cookies();
  try {
    const liffToken = cookieStore.get('line_access_token')?.value || liffAccessToken;
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
