import { NextRequest, NextResponse } from 'next/server';
import { resolveWordPressContext } from '@/server/services/wordpressContext';

// WordPress接続状態をGETメソッドで確認（WordPress.comとセルフホスト両対応）
export async function GET(request: NextRequest) {
  try {
    const context = await resolveWordPressContext(name => request.cookies.get(name)?.value);

    if (!context.success) {
      const responseBody = {
        success: false,
        connected: false,
        message: context.message,
        wpType: context.wpType ?? 'wordpress_com',
        needsWordPressAuth: context.needsWordPressAuth,
      };
      const status =
        context.reason === 'settings_missing' || context.reason === 'wordpress_auth_missing'
          ? 200
          : context.status;

      if (context.reason === 'settings_missing') {
        return NextResponse.json({
          ...responseBody,
          message: 'WordPress設定が登録されていません',
        });
      }

      return NextResponse.json(responseBody, { status });
    }

    const connectionTest = await context.service.testConnection();

    if (!connectionTest.success) {
      return NextResponse.json({
        success: false,
        connected: false,
        message: `${
          context.wpSettings.wpType === 'wordpress_com' ? 'WordPress.com' : 'セルフホストWordPress'
        }との連携が無効です`,
        error: connectionTest.error,
        wpType: context.wpSettings.wpType,
      });
    }

    return NextResponse.json({
      success: true,
      connected: true,
      message: `${
        context.wpSettings.wpType === 'wordpress_com' ? 'WordPress.com' : 'セルフホストWordPress'
      }に接続済み`,
      siteInfo: connectionTest.data,
      wpType: context.wpSettings.wpType,
    });
  } catch (error) {
    console.error('WordPress connection check error:', error);
    return NextResponse.json({
      success: false,
      connected: false,
      message: 'WordPressとの連携状態を確認できませんでした',
      error: error instanceof Error ? error.message : 'Unknown error',
      wpType: 'wordpress_com', // エラー時のデフォルト値
    });
  }
}

// POSTメソッドも統合接続テストに対応
export async function POST(request: NextRequest) {
  try {
    const context = await resolveWordPressContext(name => request.cookies.get(name)?.value);

    if (!context.success) {
      return NextResponse.json(
        {
          success: false,
          error: context.message,
          needsWordPressAuth: context.needsWordPressAuth,
        },
        { status: context.status }
      );
    }

    const connectionTest = await context.service.testConnection();

    if (!connectionTest.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            connectionTest.error ||
            `${
              context.wpSettings.wpType === 'wordpress_com' ? 'WordPress.com' : 'セルフホストWordPress'
            }への接続テストに失敗しました。`,
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
      message: `${
        context.wpSettings.wpType === 'wordpress_com' ? 'WordPress.com' : 'セルフホストWordPress'
      }接続テストが成功しました`,
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
