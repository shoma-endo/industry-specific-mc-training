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
  return (
    <div className="space-y-3">
      <div className="mx-auto max-w-7xl px-4 pt-6">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The dashboard currently displays sample data for demo purposes, and will show real
          Google Ads API data (keyword_view) after API access approval.
        </div>
      </div>
      <DashboardContent campaigns={MOCK_CAMPAIGNS} isMockData={true} />
    </div>
  );
}
