import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { gscImportService } from '@/server/services/gscImportService';

const toISODate = (date: Date) => date.toISOString().slice(0, 10);

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

    // 最新データを評価前に同期する（直近30日間）
    const today = new Date();
    const endDate = toISODate(today);
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 30);
    const startDate = toISODate(start);

    const summary = await gscImportService.importAndMaybeEvaluate(authResult.userId, {
      startDate,
      endDate,
      searchType: 'web',
      maxRows: 5000,
      runEvaluation: true,
    });

    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    console.error('[gsc/evaluate] Evaluation failed', error);
    const message = error instanceof Error ? error.message : '評価処理に失敗しました';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
