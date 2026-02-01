import {
  MousePointer2,
  TrendingUp,
  DollarSign,
  Target,
  Percent,
  Eye,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatNumber, formatCurrency, formatPercent } from '@/lib/utils';
import type { GoogleAdsCampaignSummary } from '@/types/googleAds.types';

interface MetricsCardsProps {
  summary: GoogleAdsCampaignSummary;
}

export function MetricsCards({ summary }: MetricsCardsProps) {
  return (
    <>
      {/* Metrics Cards - Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <MousePointer2 className="h-4 w-4 text-blue-500" />
              <p className="text-sm font-medium text-gray-500">クリック数</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatNumber(summary.totalClicks)}</p>
            <p className="text-xs text-gray-400 mt-1">前期間比 --%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <p className="text-sm font-medium text-gray-500">表示回数</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatNumber(summary.totalImpressions)}
            </p>
            <p className="text-xs text-gray-400 mt-1">前期間比 --%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="h-4 w-4 text-purple-500" />
              <p className="text-sm font-medium text-gray-500">CTR</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatPercent(summary.avgCtr)}</p>
            <p className="text-xs text-gray-400 mt-1">前期間比 --%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-orange-500" />
              <p className="text-sm font-medium text-gray-500">費用</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalCost)}</p>
            <p className="text-xs text-gray-400 mt-1">前期間比 --%</p>
          </CardContent>
        </Card>
      </div>

      {/* Metrics Cards - Row 2 (追加指標) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-teal-500" />
              <p className="text-sm font-medium text-gray-500">CPC</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.avgCpc)}</p>
            <p className="text-xs text-gray-400 mt-1">前期間比 --%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-red-500" />
              <p className="text-sm font-medium text-gray-500">コンバージョン数</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatNumber(summary.totalConversions)}
            </p>
            <p className="text-xs text-gray-400 mt-1">前期間比 --%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="h-4 w-4 text-indigo-500" />
              <p className="text-sm font-medium text-gray-500">コンバージョン率</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatPercent(summary.avgConversionRate)}
            </p>
            <p className="text-xs text-gray-400 mt-1">前期間比 --%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="h-4 w-4 text-cyan-500" />
              <p className="text-sm font-medium text-gray-500">検索インプレッションシェア</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatPercent(summary.avgSearchImpressionShare)}
            </p>
            <p className="text-xs text-gray-400 mt-1">前期間比 --%</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
