import { DashboardContent } from './_components/dashboard-content';
import { MOCK_CAMPAIGNS, MOCK_KEYWORDS } from '@/lib/mock-data/google-ads';

// 動的レンダリングを強制（Server Action で cookies を使用するため）
export const dynamic = 'force-dynamic';

export default async function GoogleAdsDashboardPage() {
  return (
    <div className="space-y-3">
      <div className="mx-auto max-w-7xl px-4 pt-6">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The dashboard currently displays sample data for demo purposes, and will show real
          Google Ads API data (keyword_view) after API access approval.
        </div>
      </div>
      <DashboardContent campaigns={MOCK_CAMPAIGNS} keywordMetrics={MOCK_KEYWORDS} isMockData={true} />
    </div>
  );
}
