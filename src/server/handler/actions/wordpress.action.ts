'use server';

import { cookies } from 'next/headers';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';
import {
  WordPressSettings,
  WordPressRestPost,
  WordPressNormalizedPost,
  RestRequestConfig,
  FetchCandidatesResult,
  RssNormalizeResult,
  RssItem,
  NormalizedPostResponse,
  ResolveCanonicalParams,
  ExistingAnnotationData,
  SaveWordPressSettingsParams,
} from '@/types/wordpress';
import {
  buildWordPressServiceFromSettings,
  resolveWordPressContext,
} from '@/server/services/wordpressContext';
import { normalizeWordPressRestPosts } from '@/server/services/wordpressService';
import { normalizeContentTypes } from '@/server/services/wordpressContentTypes';
import type {
  AnnotationRecord,
  ContentAnnotationPayload,
  SessionAnnotationUpsertPayload,
} from '@/types/annotation';

const supabaseService = new SupabaseService();

const DUPLICATE_CANONICAL_ERROR_MESSAGE =
  'このWordPress記事URLは別のコンテンツで既に登録されています';
const DUPLICATE_CONSTRAINT_IDENTIFIERS = [
  'content_annotations_user_id_wp_post_id_key',
  'idx_content_annotations_user_canonical_unique',
];

function isDuplicateCanonicalConstraint(error: {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}): boolean {
  if (error.code !== '23505') {
    return false;
  }
  const payload = [error.message, error.details, error.hint].filter(Boolean).join(' ');
  return DUPLICATE_CONSTRAINT_IDENTIFIERS.some(identifier => payload.includes(identifier));
}

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

async function getRestRequestConfig(
  wpSettings: WordPressSettings,
  getCookie: (name: string) => string | undefined,
  page: number,
  perPage: number
): Promise<RestRequestConfig> {
  const buildResult = buildWordPressServiceFromSettings(wpSettings, getCookie);
  if (!buildResult.success) {
    return {
      headers: {},
      candidates: [],
      siteUrlClean: '',
      isSelfHosted: wpSettings.wpType === 'self_hosted',
      error: buildResult.message,
    };
  }

  const service = buildResult.service;
  const headers = service.getRestHeaders();

  if (service.getAuthType() === 'wordpress_com') {
    const baseUrl = service.getRestBaseUrl();
    const candidates = [
      `${baseUrl}/posts?_embed=true&per_page=${perPage}&page=${page}`,
      `${baseUrl}/posts?per_page=${perPage}&page=${page}`,
    ];
    return { headers, candidates, siteUrlClean: '', isSelfHosted: false };
  }

  const siteUrlRaw = service.getSelfHostedSiteUrl() || '';
  const siteUrlClean = siteUrlRaw.replace(/\/$/, '');
  const candidates = [
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
): Promise<FetchCandidatesResult> {
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

type CookieStore = Awaited<ReturnType<typeof cookies>>;

const extractDirectPostId = (url: URL): number | null => {
  const paramNames = ['post', 'p', 'page_id'];
  for (const name of paramNames) {
    const value = url.searchParams.get(name);
    if (value && /^\d+$/.test(value)) {
      const parsed = Number(value);
      if (Number.isSafeInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return null;
};

const buildSlugCandidates = (url: URL): string[] => {
  const segments = url.pathname
    .split('/')
    .map(segment => segment.trim())
    .filter(Boolean)
    .map(segment => decodeURIComponent(segment));
  if (!segments.length) return [];

  const lastSegmentRaw = segments[segments.length - 1];
  if (!lastSegmentRaw) return [];

  const withoutSuffix = lastSegmentRaw.replace(/\.(html?|php)$/i, '');
  const candidates = new Set<string>();
  if (withoutSuffix) {
    candidates.add(withoutSuffix);
    candidates.add(withoutSuffix.toLowerCase());
  }
  if (lastSegmentRaw && lastSegmentRaw !== withoutSuffix) {
    candidates.add(lastSegmentRaw);
    candidates.add(lastSegmentRaw.toLowerCase());
  }
  return Array.from(candidates);
};

const normalizePostResponse = (data: unknown): NormalizedPostResponse => {
  if (!data || typeof data !== 'object') return { id: null };
  const record = data as Record<string, unknown>;
  const idValue = record.id ?? record.ID;
  const id =
    typeof idValue === 'number' && Number.isSafeInteger(idValue) ? (idValue as number) : null;
  const result: NormalizedPostResponse = { id };
  if (typeof record.link === 'string') {
    result.link = record.link as string;
  }
  const titleValue = record.title;
  if (typeof titleValue === 'string' && titleValue.trim().length > 0) {
    result.title = titleValue;
  } else if (
    titleValue &&
    typeof titleValue === 'object' &&
    typeof (titleValue as { rendered?: unknown }).rendered === 'string'
  ) {
    const rendered = (titleValue as { rendered?: string }).rendered?.trim() || '';
    if (rendered) {
      result.title = rendered;
    }
  }
  return result;
};

type CanonicalResolutionResult =
  | { success: true; canonicalUrl: string | null; wpPostId: number | null; wpPostTitle: string | null }
  | { success: false; error: string };

async function resolveCanonicalAndWpPostId(
  params: ResolveCanonicalParams & {
    supabaseService: SupabaseService;
    cookieStore: CookieStore;
  }
): Promise<CanonicalResolutionResult> {
  const { canonicalUrl, supabaseService: supabaseServiceLocal, userId, cookieStore } = params;

  const trimmed = typeof canonicalUrl === 'string' ? canonicalUrl.trim() : '';
  if (!trimmed) {
    return { success: true as const, canonicalUrl: null, wpPostId: null, wpPostTitle: null };
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(trimmed);
  } catch {
    return { success: false as const, error: '有効なURLを入力してください' };
  }

  const canonicalCandidate = targetUrl.toString();

  const directId = extractDirectPostId(targetUrl);
  const slugCandidates = directId === null ? buildSlugCandidates(targetUrl) : [];

  const wpSettings = await supabaseServiceLocal.getWordPressSettingsByUserId(userId);
  if (!wpSettings) {
    if (directId !== null) {
      return {
        success: true as const,
        canonicalUrl: canonicalCandidate,
        wpPostId: directId,
        wpPostTitle: null,
      };
    }
    return {
      success: false as const,
      error: 'WordPress設定が登録されていません。設定画面から連携を完了してください。',
    };
  }

  const buildResult = buildWordPressServiceFromSettings(
    wpSettings,
    name => cookieStore.get(name)?.value
  );
  if (!buildResult.success) {
    return { success: false as const, error: buildResult.message };
  }
  const wpService = buildResult.service;

  if (directId !== null) {
    const byId = await wpService.resolveContentById(directId);
    if (!byId.success) {
      return { success: false as const, error: byId.error || 'WordPress APIの呼び出しに失敗しました' };
    }
    if (!byId.data) {
      return {
        success: false as const,
        error: '指定された投稿IDがWordPressで見つかりませんでした。URLをご確認ください。',
      };
    }
    const normalized = normalizePostResponse(byId.data);
    return {
      success: true as const,
      canonicalUrl: normalized.link ?? canonicalCandidate,
      wpPostId: normalized.id ?? directId,
      wpPostTitle: normalized.title ?? null,
    };
  }

  if (!slugCandidates.length) {
    return {
      success: false as const,
      error: 'URLから投稿IDを特定できませんでした。編集URLまたは公開URLを入力してください。',
    };
  }

  type ResolveResult =
    | ({ id: number } & Partial<{ link: string; title: string }>)
    | { error: string }
    | null;
  const resolveByType = async (type: 'posts' | 'pages'): Promise<ResolveResult> => {
    let lastError: string | undefined;
    for (const slug of slugCandidates) {
      const result = await wpService.findExistingContent(slug, type);
      if (!result.success) {
        lastError = result.error || 'WordPress APIの呼び出しに失敗しました';
        continue;
      }
      if (result.data) {
        const normalized = normalizePostResponse(result.data);
        if (normalized.id) {
          const payload: { id: number } & Partial<{ link: string; title: string }> = {
            id: normalized.id,
          };
          if (normalized.link) {
            payload.link = normalized.link;
          }
          if (normalized.title) {
            payload.title = normalized.title;
          }
          return payload;
        }
      }
    }
    if (lastError) {
      return { error: lastError };
    }
    return null;
  };

  let canonicalFromApi: string | undefined;
  let resolvedWpId: number | null = null;
  let resolvedTitle: string | null = null;

  const postResult = await resolveByType('posts');
  if (postResult && 'error' in postResult) {
    return { success: false as const, error: postResult.error };
  }
  if (postResult && postResult !== null) {
    resolvedWpId = postResult.id;
    canonicalFromApi = postResult.link ?? canonicalFromApi;
    resolvedTitle = postResult.title ?? resolvedTitle;
  }

  if (resolvedWpId == null) {
    const pageResult = await resolveByType('pages');
    if (pageResult && 'error' in pageResult) {
      return { success: false as const, error: pageResult.error };
    }
    if (pageResult && pageResult !== null) {
      resolvedWpId = pageResult.id;
      canonicalFromApi = pageResult.link ?? canonicalFromApi;
      resolvedTitle = pageResult.title ?? resolvedTitle;
    }
  }

  if (resolvedWpId == null) {
    return {
      success: false as const,
      error: 'WordPressで該当する投稿が見つかりませんでした。URLをご確認ください。',
    };
  }

  return {
    success: true as const,
    canonicalUrl: canonicalFromApi ?? canonicalCandidate,
    wpPostId: resolvedWpId,
    wpPostTitle: resolvedTitle ?? null,
  };
}

async function parseRssAndNormalize(
  siteUrlClean: string,
  page: number,
  perPage: number
): Promise<RssNormalizeResult | null> {
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

      const items: RssItem[] = [];

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
        const item: RssItem = {};
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

      const normalized: WordPressNormalizedPost[] = sliced.map((it, idx) => {
        const n: WordPressNormalizedPost = {
          id: start + idx + 1,
          categoryNames: [],
        };
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
  const posts: WordPressRestPost[] = Array.isArray(postsJson)
    ? (postsJson as WordPressRestPost[])
    : [];
  const normalized = normalizeWordPressRestPosts(posts);

  return { success: true as const, data: { posts: normalized, total } };
}

// ==========================================
// Annotations (ユーザー入力) CRUD
// ==========================================

export async function upsertContentAnnotation(
  payload: ContentAnnotationPayload
): Promise<
  | { success: false; error: string }
  | { success: true; canonical_url?: string | null; wp_post_id?: number | null; wp_post_title?: string | null }
> {
  const cookieStore = await cookies();
  const liffAccessToken = cookieStore.get('line_access_token')?.value;
  const refreshToken = cookieStore.get('line_refresh_token')?.value;
  const authResult = await authMiddleware(liffAccessToken, refreshToken);
  if (authResult.error || !authResult.userId) {
    return { success: false as const, error: 'ユーザー認証に失敗しました' };
  }

  const supabaseServiceLocal = new SupabaseService();
  const client = supabaseServiceLocal.getClient();

  const canonicalProvided = Object.prototype.hasOwnProperty.call(payload, 'canonical_url');
  const nextCanonicalRaw = (payload.canonical_url ?? '').trim();
  let existingAnnotation: ExistingAnnotationData | null = null;
  let canonicalMatchesExisting = false;

  if (canonicalProvided && payload.wp_post_id !== undefined && payload.wp_post_id !== null) {
    const { data: existingData, error: existingError } = await client
      .from('content_annotations')
      .select('canonical_url, wp_post_id, wp_post_title')
      .eq('user_id', authResult.userId)
      .eq('wp_post_id', payload.wp_post_id)
      .maybeSingle();
    if (!existingError && existingData) {
      const typed = existingData as ExistingAnnotationData;
      existingAnnotation = {
        canonical_url: typed.canonical_url ?? null,
        wp_post_id: typed.wp_post_id ?? null,
        wp_post_title: typed.wp_post_title ?? null,
      };

      const existingCanonicalRaw = (existingAnnotation.canonical_url ?? '').trim();
      if (existingCanonicalRaw || nextCanonicalRaw) {
        try {
          const existingNormalized = existingCanonicalRaw ? new URL(existingCanonicalRaw).toString() : '';
          const nextNormalized = nextCanonicalRaw ? new URL(nextCanonicalRaw).toString() : '';
          canonicalMatchesExisting = existingNormalized === nextNormalized;
        } catch {
          canonicalMatchesExisting = existingCanonicalRaw === nextCanonicalRaw;
        }
      } else {
        canonicalMatchesExisting = true;
      }
    }
  }

  let resolvedCanonicalUrl: string | null = payload.canonical_url ?? null;
  let resolvedWpId: number | null = payload.wp_post_id ?? null;
  let resolvedWpTitle: string | null | undefined = undefined;

  if (canonicalProvided) {
    const resolution = await resolveCanonicalAndWpPostId({
      canonicalUrl: payload.canonical_url,
      supabaseService: supabaseServiceLocal,
      userId: authResult.userId,
      cookieStore,
    });
    if (!resolution.success) {
      if (canonicalMatchesExisting && existingAnnotation) {
        resolvedCanonicalUrl = existingAnnotation.canonical_url ?? null;
        resolvedWpId = existingAnnotation.wp_post_id ?? null;
        resolvedWpTitle = existingAnnotation.wp_post_title ?? null;
      } else {
        return { success: false as const, error: resolution.error };
      }
    } else {
      resolvedCanonicalUrl = resolution.canonicalUrl;
      resolvedWpId = resolution.wpPostId;
      resolvedWpTitle = resolution.wpPostTitle ?? null;
    }
  }

  if (canonicalProvided && resolvedCanonicalUrl && !canonicalMatchesExisting) {
    const { data: duplicateRows, error: duplicateError } = await client
      .from('content_annotations')
      .select('session_id, wp_post_id')
      .eq('user_id', authResult.userId)
      .eq('canonical_url', resolvedCanonicalUrl);

    if (duplicateError) {
      return { success: false as const, error: duplicateError.message };
    }

    const hasConflict = (duplicateRows ?? []).some(row => {
      const typed = row as Pick<AnnotationRecord, 'session_id' | 'wp_post_id'>;
      const sameWp =
        typeof typed.wp_post_id === 'number' && typeof resolvedWpId === 'number'
          ? typed.wp_post_id === resolvedWpId
          : false;
      return !sameWp;
    });

    if (hasConflict) {
      return {
        success: false as const,
        error: DUPLICATE_CANONICAL_ERROR_MESSAGE,
      };
    }
  }

  const upsertData: Record<string, unknown> = {
    user_id: authResult.userId,
    wp_post_id: resolvedWpId,
    canonical_url: canonicalProvided ? resolvedCanonicalUrl : payload.canonical_url ?? null,
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

  if (canonicalProvided) {
    upsertData.wp_post_title = resolvedWpTitle ?? null;
  }

  const { error } = await client
    .from('content_annotations')
    .upsert(upsertData, { onConflict: 'user_id,wp_post_id' });

  if (error) {
    if (isDuplicateCanonicalConstraint(error)) {
      return { success: false as const, error: DUPLICATE_CANONICAL_ERROR_MESSAGE };
    }
    return { success: false as const, error: error.message };
  }

  return {
    success: true as const,
    ...(canonicalProvided
      ? { canonical_url: resolvedCanonicalUrl ?? null, wp_post_id: resolvedWpId ?? null }
      : {}),
    ...(canonicalProvided ? { wp_post_title: resolvedWpTitle ?? null } : {}),
  };
}

export async function getContentAnnotationsForUser(): Promise<
  | { success: false; error: string }
  | { success: true; data: AnnotationRecord[] }
> {
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
  const typedData = (data ?? []) as AnnotationRecord[];
  return { success: true as const, data: typedData };
}

// ==========================================
// WordPress 設定の保存（サーバーアクション）
// ==========================================

export async function saveWordPressSettingsAction(params: SaveWordPressSettingsParams) {
  const cookieStore = await cookies();
  try {
    const { wpType, wpSiteId, wpSiteUrl, wpUsername, wpApplicationPassword, wpContentTypes } = params;
    const contentTypes = normalizeContentTypes(wpContentTypes);

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
        wpApplicationPassword,
        { wpContentTypes: contentTypes }
      );
    } else if (wpType === 'wordpress_com') {
      if (!wpSiteId) {
        return { success: false as const, error: 'WordPress.com requires site ID' };
      }

      await supabaseService.createOrUpdateWordPressSettings(authResult.userId, '', '', wpSiteId, {
        wpContentTypes: contentTypes,
      });
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
    const context = await resolveWordPressContext(
      name => cookieStore.get(name)?.value,
      { supabaseService }
    );

    if (!context.success) {
      switch (context.reason) {
        case 'line_auth_missing':
          return { success: false as const, error: 'LINE認証が必要です' };
        case 'line_auth_invalid':
        case 'requires_reauth':
          return { success: false as const, error: context.message || 'ユーザー認証に失敗しました' };
        case 'settings_missing':
          return { success: false as const, error: 'WordPress設定が登録されていません' };
        case 'wordpress_auth_missing':
          return {
            success: false as const,
            error: context.message,
            needsWordPressAuth: true,
          } as const;
        default:
          return { success: false as const, error: context.message };
      }
    }

    const connectionTest = await context.service.testConnection();
    if (!connectionTest.success) {
      return {
        success: false as const,
        error:
          connectionTest.error ||
          `${
            context.wpSettings.wpType === 'wordpress_com' ? 'WordPress.com' : 'セルフホストWordPress'
          }への接続テストに失敗しました。`,
      };
    }

    return {
      success: true as const,
      message: `${
        context.wpSettings.wpType === 'wordpress_com' ? 'WordPress.com' : 'セルフホストWordPress'
      }接続テストが成功しました`,
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

export async function getContentAnnotationBySession(session_id: string): Promise<
  | { success: false; error: string }
  | { success: true; data: AnnotationRecord | null }
> {
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
  const typedData = (data ?? null) as AnnotationRecord | null;
  return { success: true as const, data: typedData };
}

export async function upsertContentAnnotationBySession(payload: SessionAnnotationUpsertPayload & {
  wp_post_id?: number | null;
}): Promise<
  | { success: false; error: string }
  | { success: true; canonical_url?: string | null; wp_post_id?: number | null; wp_post_title?: string | null }
> {
  const cookieStore = await cookies();
  const liffAccessToken = cookieStore.get('line_access_token')?.value;
  const refreshToken = cookieStore.get('line_refresh_token')?.value;
  const authResult = await authMiddleware(liffAccessToken, refreshToken);
  if (authResult.error || !authResult.userId)
    return { success: false as const, error: 'ユーザー認証に失敗しました' };

  const supabaseServiceLocal = new SupabaseService();
  const client = supabaseServiceLocal.getClient();

  const canonicalProvided = Object.prototype.hasOwnProperty.call(payload, 'canonical_url');
  const nextCanonicalRaw = (payload.canonical_url ?? '').trim();
  let existingAnnotation: ExistingAnnotationData | null = null;
  let canonicalMatchesExisting = false;

  if (canonicalProvided) {
    const { data: existingData, error: existingError } = await client
      .from('content_annotations')
      .select('canonical_url, wp_post_id, wp_post_title')
      .eq('user_id', authResult.userId)
      .eq('session_id', payload.session_id)
      .maybeSingle();
    if (!existingError && existingData) {
      const typed = existingData as ExistingAnnotationData;
      existingAnnotation = {
        canonical_url: typed.canonical_url ?? null,
        wp_post_id: typed.wp_post_id ?? null,
        wp_post_title: typed.wp_post_title ?? null,
      };

      const existingCanonicalRaw = (existingAnnotation.canonical_url ?? '').trim();
      if (existingCanonicalRaw || nextCanonicalRaw) {
        try {
          const existingNormalized = existingCanonicalRaw ? new URL(existingCanonicalRaw).toString() : '';
          const nextNormalized = nextCanonicalRaw ? new URL(nextCanonicalRaw).toString() : '';
          canonicalMatchesExisting = existingNormalized === nextNormalized;
        } catch {
          canonicalMatchesExisting = existingCanonicalRaw === nextCanonicalRaw;
        }
      } else {
        canonicalMatchesExisting = true;
      }
    }
  }

  let resolvedCanonicalUrl: string | null | undefined = undefined;
  let resolvedWpId: number | null | undefined = undefined;
  let resolvedWpTitle: string | null | undefined = undefined;

  if (canonicalProvided) {
    const resolution = await resolveCanonicalAndWpPostId({
      canonicalUrl: payload.canonical_url,
      supabaseService: supabaseServiceLocal,
      userId: authResult.userId,
      cookieStore,
    });
    if (!resolution.success) {
      if (canonicalMatchesExisting && existingAnnotation) {
        resolvedCanonicalUrl = existingAnnotation.canonical_url ?? null;
        resolvedWpId = existingAnnotation.wp_post_id ?? null;
        resolvedWpTitle = existingAnnotation.wp_post_title ?? null;
      } else {
        return { success: false as const, error: resolution.error };
      }
    } else {
      resolvedCanonicalUrl = resolution.canonicalUrl;
      resolvedWpId = resolution.wpPostId;
      resolvedWpTitle = resolution.wpPostTitle ?? null;
    }
  }

  if (canonicalProvided && resolvedCanonicalUrl && !canonicalMatchesExisting) {
    const { data: duplicateRows, error: duplicateError } = await client
      .from('content_annotations')
      .select('session_id, wp_post_id')
      .eq('user_id', authResult.userId)
      .eq('canonical_url', resolvedCanonicalUrl);

    if (duplicateError) {
      return { success: false as const, error: duplicateError.message };
    }

    const hasConflict = (duplicateRows ?? []).some(row => {
      const typed = row as Pick<AnnotationRecord, 'session_id' | 'wp_post_id'>;
      const sameSession =
        typeof typed.session_id === 'string' && typed.session_id === payload.session_id;
      const sameWp =
        typeof typed.wp_post_id === 'number' && typeof resolvedWpId === 'number'
          ? typed.wp_post_id === resolvedWpId
          : false;
      return !(sameSession || sameWp);
    });

    if (hasConflict) {
      return {
        success: false as const,
        error: DUPLICATE_CANONICAL_ERROR_MESSAGE,
      };
    }
  }

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

  if (canonicalProvided) {
    upsertPayload.canonical_url = resolvedCanonicalUrl ?? null;
    upsertPayload.wp_post_id = resolvedWpId ?? null;
    upsertPayload.wp_post_title = resolvedWpTitle ?? null;
  }

  const { error } = await client
    .from('content_annotations')
    .upsert(upsertPayload, { onConflict: 'user_id,session_id' });

  if (error) {
    if (isDuplicateCanonicalConstraint(error)) {
      return { success: false as const, error: DUPLICATE_CANONICAL_ERROR_MESSAGE };
    }
    return { success: false as const, error: error.message };
  }
  return {
    success: true as const,
    ...(canonicalProvided
      ? {
          canonical_url: resolvedCanonicalUrl ?? null,
          wp_post_id: resolvedWpId ?? null,
        }
      : {}),
    ...(canonicalProvided ? { wp_post_title: resolvedWpTitle ?? null } : {}),
  };
}
