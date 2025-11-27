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

    // maxRows のバリデーション（GSC API の上限は 25000）
    if (typeof maxRows !== 'number' || maxRows < 1 || maxRows > 25000) {
      return NextResponse.json(
        { success: false, error: 'maxRows は 1～25000 の範囲で指定してください' },
        { status: 400 }
      );
    }

    // 期間のバリデーション（最大365日）
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json(
        { success: false, error: '日付の形式が不正です' },
        { status: 400 }
      );
    }
    if (start > end) {
      return NextResponse.json(
        { success: false, error: '開始日は終了日より前である必要があります' },
        { status: 400 }
      );
    }
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      return NextResponse.json(
        { success: false, error: '期間は最大365日までです' },
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
