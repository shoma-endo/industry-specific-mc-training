import { NextRequest, NextResponse } from 'next/server';
import { fetchKeywordMetrics } from '@/server/actions/googleAds.actions';
import { keywordMetricsQuerySchema } from '@/server/schemas/googleAds.schema';
import { ERROR_MESSAGES } from '@/domain/errors/error-messages';

/**
 * GET /api/google-ads/keywords
 *
 * クエリパラメータ:
 * - customerId: Google Ads カスタマー ID（ハイフンなし 10桁）
 * - startDate: 開始日（YYYY-MM-DD 形式）
 * - endDate: 終了日（YYYY-MM-DD 形式）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 必須パラメータのチェック
    if (!customerId) {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.GOOGLE_ADS.CUSTOMER_ID_REQUIRED },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.GOOGLE_ADS.DATE_RANGE_REQUIRED },
        { status: 400 }
      );
    }

    // 入力バリデーション
    const parseResult = keywordMetricsQuerySchema.safeParse({
      customerId,
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

    // Server Action を呼び出し
    const result = await fetchKeywordMetrics(customerId, startDate, endDate);

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
