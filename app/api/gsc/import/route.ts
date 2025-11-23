import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { googleSearchConsoleImportService } from '@/server/services/googleSearchConsoleImportService';

export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json().catch(() => ({}));
    const { startDate, endDate, searchType = 'web', maxRows = 1000, runEvaluation = true } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'startDate と endDate は必須です' },
        { status: 400 }
      );
    }

    const summary = await googleSearchConsoleImportService.importAndMaybeEvaluate(authResult.userId, {
      startDate,
      endDate,
      searchType,
      maxRows,
      runEvaluation,
    });

    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    console.error('[gsc/import] Import failed', error);
    const message = error instanceof Error ? error.message : 'インポート処理に失敗しました';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
