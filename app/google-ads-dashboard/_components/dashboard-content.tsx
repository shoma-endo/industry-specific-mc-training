import { BarChart3, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MetricsCards } from './metrics-cards';
import { CampaignsTable } from './campaigns-table';
import { calculateCampaignSummary } from '@/lib/mock-data/google-ads';
import type { GoogleAdsCampaignMetrics } from '@/types/googleAds.types';

interface DashboardContentProps {
  campaigns: GoogleAdsCampaignMetrics[];
  isMockData: boolean;
  error?: string;
}

/**
 * シンプルなエラー表示（デバッグ用）
 */
function ErrorDisplay({ error }: { error: string }) {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4 max-w-lg">
          <div className="flex justify-center">
            <div className="rounded-full bg-red-50 p-3">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-gray-900">データの取得に失敗しました</p>
            <p className="text-sm text-gray-600">{error}</p>
            <p className="text-xs text-gray-500">
              エラーコードはサーバーログで確認してください
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/setup/google-ads">
              <ExternalLink className="h-4 w-4 mr-2" />
              設定を確認
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DashboardContent({ campaigns, isMockData, error }: DashboardContentProps) {
  // エラーがある場合はエラー表示を返す
  if (error) {
    return <ErrorDisplay error={error} />;
  }

  const summary = calculateCampaignSummary(campaigns);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            Google Ads パフォーマンス
          </h1>
          <p className="text-gray-500">
            連携済みアカウントの広告パフォーマンス概要
            {isMockData && <span className="text-orange-500 ml-2">（開発用モックデータ）</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" disabled>
            期間: 過去30日間
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <MetricsCards summary={summary} />

      {/* Campaigns Table */}
      <CampaignsTable campaigns={campaigns} />
    </div>
  );
}
