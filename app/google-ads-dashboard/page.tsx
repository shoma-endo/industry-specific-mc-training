import { DashboardContent } from './_components/dashboard-content';
import { MOCK_CAMPAIGNS, aggregateKeywordsToCampaigns } from '@/lib/mock-data/google-ads';
import { fetchKeywordMetrics } from '@/server/actions/googleAds.actions';

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
      // エラー情報を渡してエラー表示（デバッグ用）
      console.error('[GoogleAdsDashboard] Failed to fetch keyword metrics:', result.error);
      return (
        <DashboardContent
          campaigns={[]}
          isMockData={false}
          error={result.error}
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
        error="予期しないエラーが発生しました"
      />
    );
  }
}
