import { DashboardContent } from './_components/dashboard-content';
import { MOCK_CAMPAIGNS, aggregateKeywordsToCampaigns } from '@/lib/mock-data/google-ads';
import { fetchKeywordMetrics } from '@/server/actions/googleAds.actions';
import { ERROR_MESSAGES } from '@/domain/errors/error-messages';

// 動的レンダリングを強制（Server Action で cookies を使用するため）
export const dynamic = 'force-dynamic';

/**
 * 過去30日間の日付範囲を取得
 */
function getLast30DaysRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);

  // YYYY-MM-DD 形式にフォーマット
  const formatDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  };
}

export default async function GoogleAdsDashboardPage() {
  const isDev = process.env.NODE_ENV === 'development';

  // 開発環境ではモックデータを使用
  if (isDev) {
    return <DashboardContent campaigns={MOCK_CAMPAIGNS} isMockData={true} />;
  }

  // 本番環境では API からデータを取得
  const { startDate, endDate } = getLast30DaysRange();

  try {
    // Server Action がクッキーから認証情報を取得
    const result = await fetchKeywordMetrics(startDate, endDate);

    if (!result.success) {
      console.error('[GoogleAdsDashboard] Failed to fetch keyword metrics:', result.error);
      let errorKind: 'not_connected' | 'not_selected' | 'auth_expired' | 'admin_required' | 'unknown' = 'unknown';
      if (result.error === ERROR_MESSAGES.GOOGLE_ADS.NOT_CONNECTED) {
        errorKind = 'not_connected';
      } else if (result.error === ERROR_MESSAGES.GOOGLE_ADS.ACCOUNT_NOT_SELECTED) {
        errorKind = 'not_selected';
      } else if (result.error === ERROR_MESSAGES.GOOGLE_ADS.AUTH_EXPIRED_OR_REVOKED) {
        errorKind = 'auth_expired';
      } else if (result.error === ERROR_MESSAGES.USER.ADMIN_REQUIRED) {
        errorKind = 'admin_required';
      }
      return (
        <DashboardContent
          campaigns={[]}
          isMockData={false}
          errorMessage={result.error ?? ERROR_MESSAGES.GOOGLE_ADS.DASHBOARD_FETCH_FAILED}
          errorKind={errorKind}
        />
      );
    }

    // キーワードデータをキャンペーン単位に集計
    const campaigns = aggregateKeywordsToCampaigns(result.data ?? []);
    return <DashboardContent campaigns={campaigns} isMockData={false} />;
  } catch (error) {
    console.error('[GoogleAdsDashboard] Error:', error);
    return (
      <DashboardContent
        campaigns={[]}
        isMockData={false}
        errorMessage={ERROR_MESSAGES.GOOGLE_ADS.UNKNOWN_ERROR}
        errorKind="unknown"
      />
    );
  }
}
