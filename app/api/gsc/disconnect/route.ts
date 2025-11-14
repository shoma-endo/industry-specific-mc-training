import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';

const supabaseService = new SupabaseService();

export async function POST(request: NextRequest) {
  const liffAccessToken = request.cookies.get('line_access_token')?.value;
  const refreshToken = request.cookies.get('line_refresh_token')?.value;

  if (!liffAccessToken) {
    return NextResponse.json({ success: false, error: 'LINE認証が必要です' }, { status: 401 });
  }

  const authResult = await authMiddleware(liffAccessToken, refreshToken);
  if (authResult.error || !authResult.userId) {
    return NextResponse.json(
      { success: false, error: authResult.error || 'ユーザー認証に失敗しました' },
      { status: 401 }
    );
  }

  try {
    await supabaseService.deleteGscCredential(authResult.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to disconnect Google Search Console', error);
    return NextResponse.json(
      { success: false, error: '連携解除に失敗しました' },
      { status: 500 }
    );
  }
}
