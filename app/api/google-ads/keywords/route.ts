import { NextRequest, NextResponse } from 'next/server';
import { fetchKeywordMetrics } from '@/server/actions/googleAds.actions';
import { keywordMetricsQuerySchema } from '@/server/schemas/googleAds.schema';
import { ERROR_MESSAGES } from '@/domain/errors/error-messages';

/**
 * GET /api/google-ads/keywords
 *
 * クエリパラメータ:
 * - startDate: 開始日（YYYY-MM-DD 形式）
 * - endDate: 終了日（YYYY-MM-DD 形式）
 *
 * customerId は DB に保存された選択済みアカウントを使用
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 必須パラメータのチェック
    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.GOOGLE_ADS.DATE_RANGE_REQUIRED },
        { status: 400 }
      );
    }

    // 入力バリデーション
    const parseResult = keywordMetricsQuerySchema.safeParse({
      startDate,
      endDate,
    });

    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((issue) => issue.message).join(', ');
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.GOOGLE_ADS.INVALID_INPUT(errors) },
        { status: 400 }
      );
    }

    // Server Action を呼び出し（customerId は DB から取得）
    const result = await fetchKeywordMetrics(startDate, endDate);

    if (!result.success) {
      // 認証エラーの場合は 401 を返す
      if (
        result.error === ERROR_MESSAGES.AUTH.NOT_LOGGED_IN ||
        result.error === ERROR_MESSAGES.AUTH.UNAUTHENTICATED
      ) {
        return NextResponse.json({ success: false, error: result.error }, { status: 401 });
      }

      // 権限エラーの場合は 403 を返す
      if (result.error === ERROR_MESSAGES.USER.ADMIN_REQUIRED) {
        return NextResponse.json({ success: false, error: result.error }, { status: 403 });
      }

      // アカウント未選択の場合は 400 を返す
      if (result.error === ERROR_MESSAGES.GOOGLE_ADS.ACCOUNT_NOT_SELECTED) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }

      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[GET /api/google-ads/keywords] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.GOOGLE_ADS.UNKNOWN_ERROR,
      },
      { status: 500 }
    );
  }
}
