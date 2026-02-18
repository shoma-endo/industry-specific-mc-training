import { DashboardContent } from './_components/dashboard-content';
import { fetchKeywordMetrics } from '@/server/actions/googleAds.actions';
import { aggregateKeywordsToCampaigns } from '@/lib/google-ads-utils';
import { buildLocalDateRange } from '@/lib/date-utils';
import { ERROR_MESSAGES } from '@/domain/errors/error-messages';

// 動的レンダリングを強制（Server Action で cookies を使用するため）
export const dynamic = 'force-dynamic';

/**
 * エラーメッセージからエラー種別を判定する
 */
function resolveErrorKind(
  errorMessage: string
): 'not_connected' | 'not_selected' | 'auth_expired' | 'admin_required' | 'unknown' {
  switch (errorMessage) {
    case ERROR_MESSAGES.GOOGLE_ADS.NOT_CONNECTED:
      return 'not_connected';
    case ERROR_MESSAGES.GOOGLE_ADS.ACCOUNT_NOT_SELECTED:
      return 'not_selected';
    case ERROR_MESSAGES.GOOGLE_ADS.AUTH_EXPIRED_OR_REVOKED:
      return 'auth_expired';
    case ERROR_MESSAGES.USER.ADMIN_REQUIRED:
      return 'admin_required';
    default:
      return 'unknown';
  }
}

export default async function GoogleAdsDashboardPage() {
  // 過去30日間の日付範囲を計算（JST基準、今日含む30日間）
  const { startDate, endDate } = buildLocalDateRange(30);

  const result = await fetchKeywordMetrics(startDate, endDate);

  if (!result.success || !result.data) {
    const errorMessage = result.error ?? ERROR_MESSAGES.GOOGLE_ADS.DASHBOARD_FETCH_FAILED;
    return (
      <DashboardContent
        campaigns={[]}
        errorMessage={errorMessage}
        errorKind={resolveErrorKind(errorMessage)}
      />
    );
  }

  const campaigns = aggregateKeywordsToCampaigns(result.data);

  return <DashboardContent campaigns={campaigns} />;
}
