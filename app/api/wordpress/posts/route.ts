import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';
import { WordPressService, WordPressAuth } from '@/server/services/wordpressService';

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

export async function GET(request: NextRequest) {
  try {
    const liffAccessToken = request.cookies.get('line_access_token')?.value;
    const refreshToken = request.cookies.get('line_refresh_token')?.value;

    if (!liffAccessToken) {
      return NextResponse.json({ success: false, error: 'LINE認証が必要です' }, { status: 401 });
    }

    const authResult = await authMiddleware(liffAccessToken, refreshToken);
    if (authResult.error || !authResult.userId) {
      return NextResponse.json(
        { success: false, error: 'ユーザー認証に失敗しました' },
        { status: 401 }
      );
    }

    // ページネーション
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = Math.min(parseInt(searchParams.get('per_page') || '20', 10), 100);

    const supabaseService = new SupabaseService();
    const wpSettings = await supabaseService.getWordPressSettingsByUserId(authResult.userId);

    if (!wpSettings) {
      return NextResponse.json({ success: true, data: { posts: [], total: 0 } });
    }

    // WordPressサービスを構築
    let auth: WordPressAuth;
    if (wpSettings.wpType === 'wordpress_com') {
      const tokenCookieName = process.env.OAUTH_TOKEN_COOKIE_NAME || 'wpcom_oauth_token';
      const accessToken = request.cookies.get(tokenCookieName)?.value;
      if (!accessToken) {
        return NextResponse.json(
          { success: false, error: 'WordPress.comの認証がありません' },
          { status: 400 }
        );
      }
      auth = {
        type: 'wordpress_com',
        wpComAuth: {
          accessToken,
          siteId: wpSettings.wpSiteId || '',
        },
      };
      // 認証検証目的でインスタンス化（以降は自前でURL/ヘッダを計算）
      new WordPressService(auth);
    } else {
      auth = {
        type: 'self_hosted',
        selfHostedAuth: {
          siteUrl: wpSettings.wpSiteUrl || '',
          username: wpSettings.wpUsername || '',
          applicationPassword: wpSettings.wpApplicationPassword || '',
        },
      };
      // 認証検証目的でインスタンス化（以降は自前でURL/ヘッダを計算）
      new WordPressService(auth);
    }

    // WordPress REST API から投稿を取得（サービスのプライベート値に依存せず自前で算出）
    const commonHeaders: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'IndustrySpecificMC/1.0 (+app)',
    };

    let baseUrl: string;
    let headers: Record<string, string>;

    if (wpSettings.wpType === 'wordpress_com') {
      baseUrl = `https://public-api.wordpress.com/wp/v2/sites/${wpSettings.wpSiteId || ''}`;
      const tokenCookieName = process.env.OAUTH_TOKEN_COOKIE_NAME || 'wpcom_oauth_token';
      const accessToken = request.cookies.get(tokenCookieName)?.value || '';
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
    const resp = await fetch(postsUrl, { headers });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => resp.statusText);
      return NextResponse.json(
        { success: false, error: `WordPress投稿取得エラー: HTTP ${resp.status} ${txt}` },
        { status: 502 }
      );
    }

    const postsJson: unknown = await resp.json();
    const posts: WpRestPost[] = Array.isArray(postsJson) ? (postsJson as WpRestPost[]) : [];
    const total = parseInt(resp.headers.get('X-WP-Total') || '0', 10);

    // 必要フィールドのみ整形
    const normalized = posts.map(
      (
        p
      ): {
        id: number | string | undefined;
        date: string | undefined;
        title: string | undefined;
        link: string | undefined;
        categories: number[] | undefined;
        categoryNames: string[];
        excerpt: string | undefined;
      } => {
        const termsNested = p._embedded?.['wp:term'] ?? [];
        const firstTaxonomy =
          Array.isArray(termsNested) && termsNested.length > 0 ? termsNested[0] : [];
        const categoryNames = (firstTaxonomy || [])
          .filter((t: WpRestTerm) => Boolean(t && t.name))
          .map((t: WpRestTerm) => t.name as string);

        const renderedTitle = typeof p.title === 'string' ? p.title : p.title?.rendered;
        const renderedExcerpt = typeof p.excerpt === 'string' ? p.excerpt : p.excerpt?.rendered;

        return {
          id: p.id ?? p.ID,
          date: p.date ?? p.modified,
          title: renderedTitle,
          link: p.link,
          categories: p.categories,
          categoryNames,
          excerpt: renderedExcerpt,
        };
      }
    );

    return NextResponse.json({ success: true, data: { posts: normalized, total } });
  } catch (error) {
    console.error('WP posts API error:', error);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
