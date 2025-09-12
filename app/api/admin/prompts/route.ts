import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { getUserRole, isAdmin } from '@/auth-utils';
import { PromptService } from '@/server/services/promptService';

export async function GET(request: NextRequest) {
  try {
    const liffAccessToken = request.cookies.get('line_access_token')?.value;
    const refreshToken = request.cookies.get('line_refresh_token')?.value;

    if (!liffAccessToken) {
      return NextResponse.json({ success: false, error: 'LINE認証が必要です' }, { status: 401 });
    }

    const authResult = await authMiddleware(liffAccessToken, refreshToken);
    if (authResult.error) {
      return NextResponse.json(
        { success: false, error: 'ユーザー認証に失敗しました' },
        { status: 401 }
      );
    }

    const role = await getUserRole(liffAccessToken);
    if (!isAdmin(role)) {
      return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 });
    }

    const templates = await PromptService.getAllTemplates();
    return NextResponse.json({ success: true, data: templates });
  } catch (error) {
    console.error('Admin prompts list API error:', error);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
