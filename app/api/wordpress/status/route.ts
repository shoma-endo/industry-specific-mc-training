import { NextRequest, NextResponse } from 'next/server';
import { resolveWordPressContext } from '@/server/services/wordpressContext';
type ConnectionStatus = {
  connected: boolean;
  status: 'connected' | 'error' | 'not_configured';
  message: string;
  wpType?: 'wordpress_com' | 'self_hosted';
  lastUpdated?: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const connection = await buildConnectionStatus(request);
    if (!connection.ok) {
      return NextResponse.json(
        { success: false, error: connection.error },
        { status: connection.status }
      );
    }

    return NextResponse.json({
      success: true,
      data: connection.data,
    });
  } catch (error) {
    console.error('WordPress status API error:', error);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

async function buildConnectionStatus(
  request: NextRequest
): Promise<
  | { ok: true; data: ConnectionStatus }
  | { ok: false; error: string; status: number }
> {
  const context = await resolveWordPressContext(name => request.cookies.get(name)?.value);

  if (!context.success) {
    if (context.reason === 'settings_missing') {
      return {
        ok: true,
        data: {
          connected: false,
          status: 'not_configured',
          message: 'WordPress設定が未完了です',
        },
      };
    }

    if (context.reason === 'wordpress_auth_missing' && context.wpSettings) {
      return {
        ok: true,
        data: {
          connected: false,
          status: 'error',
          message: context.message,
          wpType: context.wpSettings.wpType,
          lastUpdated: context.wpSettings.updatedAt ?? null,
        },
      };
    }

    return { ok: false, error: context.message, status: context.status };
  }

  const testResult = await context.service.testConnection();

  if (!testResult.success) {
    return {
      ok: true,
      data: {
        connected: false,
        status: 'error',
        message: testResult.error || '接続エラー',
        wpType: context.wpSettings.wpType,
        lastUpdated: context.wpSettings.updatedAt ?? null,
      },
    };
  }

  return {
    ok: true,
    data: {
      connected: true,
      status: 'connected',
      message: `WordPress (${context.wpSettings.wpType === 'wordpress_com' ? 'WordPress.com' : 'セルフホスト'}) に接続済み`,
      wpType: context.wpSettings.wpType,
      lastUpdated: context.wpSettings.updatedAt ?? null,
    },
  };
}
