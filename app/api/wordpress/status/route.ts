import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';
import { WordPressService, WordPressAuth } from '@/server/services/wordpressService';

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

    const supabaseService = new SupabaseService();
    const wpSettings = await supabaseService.getWordPressSettingsByUserId(authResult.userId);

    if (!wpSettings) {
      return NextResponse.json({
        success: true,
        data: {
          connected: false,
          status: 'not_configured',
          message: 'WordPress設定が未完了です',
        },
      });
    }

    // WordPressサービスを構築
    let wpService: WordPressService;
    if (wpSettings.wpType === 'wordpress_com') {
      const tokenCookieName = process.env.OAUTH_TOKEN_COOKIE_NAME || 'wpcom_oauth_token';
      const accessToken = request.cookies.get(tokenCookieName)?.value;
      if (!accessToken) {
        return NextResponse.json({
          success: true,
          data: {
            connected: false,
            status: 'error',
            message: 'WordPress.comとの連携が必要です',
            wpType: wpSettings.wpType,
            lastUpdated: wpSettings.updatedAt,
          },
        });
      }
      const auth: WordPressAuth = {
        type: 'wordpress_com',
        wpComAuth: {
          accessToken,
          siteId: wpSettings.wpSiteId || '',
        },
      };
      wpService = new WordPressService(auth);
    } else {
      const auth: WordPressAuth = {
        type: 'self_hosted',
        selfHostedAuth: {
          siteUrl: wpSettings.wpSiteUrl || '',
          username: wpSettings.wpUsername || '',
          applicationPassword: wpSettings.wpApplicationPassword || '',
        },
      };
      wpService = new WordPressService(auth);
    }

    const testResult = await wpService.testConnection();

    if (!testResult.success) {
      return NextResponse.json({
        success: true,
        data: {
          connected: false,
          status: 'error',
          message: testResult.error || '接続エラー',
          wpType: wpSettings.wpType,
          lastUpdated: wpSettings.updatedAt,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        status: 'connected',
        message: `WordPress (${wpSettings.wpType === 'wordpress_com' ? 'WordPress.com' : 'セルフホスト'}) に接続済み`,
        wpType: wpSettings.wpType,
        lastUpdated: wpSettings.updatedAt,
      },
    });
  } catch (error) {
    console.error('WordPress status API error:', error);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
