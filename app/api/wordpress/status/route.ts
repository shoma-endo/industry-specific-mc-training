import { NextRequest, NextResponse } from 'next/server';
import { resolveWordPressContext } from '@/server/services/wordpressContext';

export async function GET(request: NextRequest) {
  try {
    const context = await resolveWordPressContext(name => request.cookies.get(name)?.value);

    if (!context.success) {
      if (context.reason === 'settings_missing') {
        return NextResponse.json({
          success: true,
          data: {
            connected: false,
            status: 'not_configured',
            message: 'WordPress設定が未完了です',
          },
        });
      }

      if (context.reason === 'wordpress_auth_missing' && context.wpSettings) {
        return NextResponse.json({
          success: true,
          data: {
            connected: false,
            status: 'error',
            message: context.message,
            wpType: context.wpSettings.wpType,
            lastUpdated: context.wpSettings.updatedAt,
          },
        });
      }

      return NextResponse.json({
        success: false,
        error: context.message,
      }, { status: context.status });
    }

    const testResult = await context.service.testConnection();

    if (!testResult.success) {
      return NextResponse.json({
        success: true,
        data: {
          connected: false,
          status: 'error',
          message: testResult.error || '接続エラー',
          wpType: context.wpSettings.wpType,
          lastUpdated: context.wpSettings.updatedAt,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        status: 'connected',
        message: `WordPress (${
          context.wpSettings.wpType === 'wordpress_com' ? 'WordPress.com' : 'セルフホスト'
        }) に接続済み`,
        wpType: context.wpSettings.wpType,
        lastUpdated: context.wpSettings.updatedAt,
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
