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
  return <DashboardContent campaigns={MOCK_CAMPAIGNS} isMockData={true} />;
}
