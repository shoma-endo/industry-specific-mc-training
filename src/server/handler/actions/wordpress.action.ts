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

  const postsUrl = `${baseUrl}/posts?_embed=true&per_page=${perPage}&page=${page}`;
  const resp = await fetch(postsUrl, { headers, cache: 'no-store' });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => resp.statusText);
    console.error('[WP posts] Fetch failed', { url: postsUrl, status: resp.status, txt });
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
