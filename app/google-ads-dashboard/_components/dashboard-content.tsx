import Link from 'next/link';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MetricsCards } from './metrics-cards';
import { CampaignsTable } from './campaigns-table';
import { calculateCampaignSummary } from '@/lib/mock-data/google-ads';
import type { GoogleAdsCampaignMetrics } from '@/types/googleAds.types';

interface DashboardContentProps {
  campaigns: GoogleAdsCampaignMetrics[];
  isMockData: boolean;
}

export function DashboardContent({ campaigns, isMockData }: DashboardContentProps) {
  const summary = calculateCampaignSummary(campaigns);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/setup"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            設定に戻る
          </Link>
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
