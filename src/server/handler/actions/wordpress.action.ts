'use server';

import { cookies } from 'next/headers';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';
import { WordPressSettings } from '@/types/wordpress';

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
    headers = { ...commonHeaders, Authorization: `Bearer ${accessToken}` };
  } else {
    const siteUrl = (wpSettings.wpSiteUrl || '').replace(/\/$/, '');
    baseUrl = `${siteUrl}/wp-json/wp/v2`;
    const username = wpSettings.wpUsername || '';
    const appPass = wpSettings.wpApplicationPassword || '';
    const credentials = Buffer.from(`${username}:${appPass}`).toString('base64');
    headers = { ...commonHeaders, Authorization: `Basic ${credentials}` };
  }

  const postsUrl = `${baseUrl}/posts?_embed=true&per_page=${perPage}&page=${page}`;
  const resp = await fetch(postsUrl, { headers, cache: 'no-store' });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => resp.statusText);
    return {
      success: false as const,
      error: `WordPress投稿取得エラー: HTTP ${resp.status} ${txt}`,
    };
  }

  const postsJson: unknown = await resp.json();
  const total = parseInt(resp.headers.get('X-WP-Total') || '0', 10);
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
