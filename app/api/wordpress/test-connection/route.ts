import { NextRequest, NextResponse } from 'next/server';
import { WordPressService, WordPressComAuth } from '@/server/services/wordpressService';
import { SupabaseService } from '@/server/services/supabaseService';
import { authMiddleware } from '@/server/middleware/auth.middleware';

// WordPress.com接続状態をGETメソッドで確認
export async function GET(request: NextRequest) {
  try {
    const tokenCookieName = process.env.OAUTH_TOKEN_COOKIE_NAME || 'wpcom_oauth_token';
    const accessToken = request.cookies.get(tokenCookieName)?.value;

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        connected: false,
        message: 'WordPress.comとの連携が必要です',
      });
    }

    let siteId = process.env.WORDPRESS_COM_SITE_ID;

    if (!siteId) {
      try {
        const liffAccessToken = request.cookies.get('line_access_token')?.value;
        const refreshToken = request.cookies.get('line_refresh_token')?.value;

        if (liffAccessToken) {
          const authResult = await authMiddleware(liffAccessToken, refreshToken);
          if (!authResult.error && authResult.userId) {
            const supabaseService = new SupabaseService();
            const wpSettings = await supabaseService.getWordPressSettingsByUserId(
              authResult.userId
            );
            if (wpSettings?.wp_site_id) {
              siteId = wpSettings.wp_site_id;
            }
          }
        }
      } catch (error) {
        console.error('Failed to resolve user specific WordPress site ID:', error);
      }
    }

    if (!siteId) {
      return NextResponse.json({
        success: false,
        connected: false,
        message: 'WordPressサイトIDが設定されていません',
      });
    }

    const auth: WordPressComAuth = { accessToken, siteId };
    const wordpressService = new WordPressService(auth);

    const connectionTest = await wordpressService.testConnection();

    if (!connectionTest.success) {
      return NextResponse.json({
        success: false,
        connected: false,
        message: 'WordPress.comとの連携が無効です',
        error: connectionTest.error,
      });
    }

    return NextResponse.json({
      success: true,
      connected: true,
      message: 'WordPress.comに接続済み',
      siteInfo: connectionTest.data,
    });
  } catch (error) {
    console.error('WordPress connection check error:', error);
    return NextResponse.json({
      success: false,
      connected: false,
      message: 'WordPress.comとの連携状態を確認できませんでした',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// POSTメソッドは既存のテスト機能として維持
export async function POST(request: NextRequest) {
  try {
    // LIFF Access Tokenの検証処理は削除

    // WordPress.com OAuth Tokenの処理はここから
    const tokenCookieName = process.env.OAUTH_TOKEN_COOKIE_NAME || 'wpcom_oauth_token';
    const accessToken = request.cookies.get(tokenCookieName)?.value;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'WordPress.comのアクセストークンが見つかりません。連携を行ってください。',
          needsWordPressAuth: true,
        },
        { status: 401 }
      );
    }

    let siteId = process.env.WORDPRESS_COM_SITE_ID;

    if (!siteId) {
      try {
        const liffAccessToken = request.cookies.get('line_access_token')?.value;
        const refreshToken = request.cookies.get('line_refresh_token')?.value;
        if (liffAccessToken) {
          const authResult = await authMiddleware(liffAccessToken, refreshToken);
          if (!authResult.error && authResult.userId) {
            const supabaseService = new SupabaseService();
            const wpSettings = await supabaseService.getWordPressSettingsByUserId(
              authResult.userId
            );
            if (wpSettings?.wp_site_id) {
              siteId = wpSettings.wp_site_id;
            }
          }
        }
      } catch (error) {
        console.error('Failed to resolve user specific WordPress site ID (POST):', error);
      }
    }

    if (!siteId) {
      console.error('WORDPRESS_COM_SITE_ID not found for current user.');
      return NextResponse.json(
        { success: false, error: 'WordPressサイトIDが設定されていません。' },
        { status: 500 }
      );
    }

    const auth: WordPressComAuth = { accessToken, siteId };
    const wordpressService = new WordPressService(auth);

    const connectionTest = await wordpressService.testConnection();

    if (!connectionTest.success) {
      return NextResponse.json(
        {
          success: false,
          error: connectionTest.error || 'WordPress.comへの接続テストに失敗しました。',
        },
        // トークン関連エラー(例: "Invalid token", "Token expired")の場合401を返すようにする判定を追加
        {
          status:
            connectionTest.error &&
            (connectionTest.error.toLowerCase().includes('token') ||
              connectionTest.error.toLowerCase().includes('invalid_request'))
              ? 401
              : 400,
        }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'WordPress.com接続テストが成功しました',
      siteInfo: connectionTest.data,
    });
  } catch (error) {
    console.error('WordPress connection test error:', error);
    // ZodError のキャッチは不要になる
    // if (error instanceof z.ZodError) {
    //   return NextResponse.json(
    //     { success: false, error: 'リクエストデータが無効です', details: error.errors },
    //     { status: 400 }
    //   );
    // }
    return NextResponse.json(
      { success: false, error: '接続テスト中に予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
