import { NextRequest, NextResponse } from 'next/server';
import {
  WordPressService,
  WordPressAuth,
} from '@/server/services/wordpressService';
import { SupabaseService } from '@/server/services/supabaseService';
import { authMiddleware } from '@/server/middleware/auth.middleware';

// WordPress接続状態をGETメソッドで確認（WordPress.comとセルフホスト両対応）
export async function GET(request: NextRequest) {
  try {
    const liffAccessToken = request.cookies.get('line_access_token')?.value;
    const refreshToken = request.cookies.get('line_refresh_token')?.value;

    if (!liffAccessToken) {
      return NextResponse.json({
        success: false,
        connected: false,
        message: 'LINE認証が必要です',
      });
    }

    const authResult = await authMiddleware(liffAccessToken, refreshToken);
    if (authResult.error || !authResult.userId) {
      return NextResponse.json({
        success: false,
        connected: false,
        message: 'ユーザー認証に失敗しました',
      });
    }

    const supabaseService = new SupabaseService();
    const wpSettings = await supabaseService.getWordPressSettingsByUserId(authResult.userId);

    if (!wpSettings) {
      return NextResponse.json({
        success: false,
        connected: false,
        message: 'WordPress設定が登録されていません',
      });
    }

    let wordpressService: WordPressService;

    if (wpSettings.wpType === 'wordpress_com') {
      // WordPress.com用の接続確認
      const tokenCookieName = process.env.OAUTH_TOKEN_COOKIE_NAME || 'wpcom_oauth_token';
      const accessToken = request.cookies.get(tokenCookieName)?.value;

      if (!accessToken) {
        return NextResponse.json({
          success: false,
          connected: false,
          message: 'WordPress.comとの連携が必要です',
        });
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
      // セルフホスト用の接続確認
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
      return NextResponse.json({
        success: false,
        connected: false,
        message: `${wpSettings.wpType === 'wordpress_com' ? 'WordPress.com' : 'セルフホストWordPress'}との連携が無効です`,
        error: connectionTest.error,
      });
    }

    return NextResponse.json({
      success: true,
      connected: true,
      message: `${wpSettings.wpType === 'wordpress_com' ? 'WordPress.com' : 'セルフホストWordPress'}に接続済み`,
      siteInfo: connectionTest.data,
    });
  } catch (error) {
    console.error('WordPress connection check error:', error);
    return NextResponse.json({
      success: false,
      connected: false,
      message: 'WordPressとの連携状態を確認できませんでした',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// POSTメソッドも統合接続テストに対応
export async function POST(request: NextRequest) {
  try {
    const liffAccessToken = request.cookies.get('line_access_token')?.value;
    const refreshToken = request.cookies.get('line_refresh_token')?.value;

    if (!liffAccessToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'LINE認証が必要です',
        },
        { status: 401 }
      );
    }

    const authResult = await authMiddleware(liffAccessToken, refreshToken);
    if (authResult.error || !authResult.userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'ユーザー認証に失敗しました',
        },
        { status: 401 }
      );
    }

    const supabaseService = new SupabaseService();
    const wpSettings = await supabaseService.getWordPressSettingsByUserId(authResult.userId);

    if (!wpSettings) {
      return NextResponse.json(
        {
          success: false,
          error: 'WordPress設定が登録されていません',
        },
        { status: 400 }
      );
    }

    let wordpressService: WordPressService;

    if (wpSettings.wpType === 'wordpress_com') {
      // WordPress.com用の接続テスト
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

      const auth: WordPressAuth = {
        type: 'wordpress_com',
        wpComAuth: {
          accessToken,
          siteId: wpSettings.wpSiteId || '',
        },
      };
      wordpressService = new WordPressService(auth);
    } else {
      // セルフホスト用の接続テスト
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
      return NextResponse.json(
        {
          success: false,
          error:
            connectionTest.error ||
            `${wpSettings.wpType === 'wordpress_com' ? 'WordPress.com' : 'セルフホストWordPress'}への接続テストに失敗しました。`,
        },
        {
          status:
            connectionTest.error &&
            (connectionTest.error.toLowerCase().includes('token') ||
              connectionTest.error.toLowerCase().includes('invalid_request') ||
              connectionTest.error.toLowerCase().includes('unauthorized'))
              ? 401
              : 400,
        }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${wpSettings.wpType === 'wordpress_com' ? 'WordPress.com' : 'セルフホストWordPress'}接続テストが成功しました`,
      siteInfo: connectionTest.data,
    });
  } catch (error) {
    console.error('WordPress connection test error:', error);
    return NextResponse.json(
      { success: false, error: '接続テスト中に予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
