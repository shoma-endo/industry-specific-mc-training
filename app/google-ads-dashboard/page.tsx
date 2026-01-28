'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  DollarSign,
  MousePointer2,
  Target,
  Percent,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatNumber, formatCurrency, formatPercent } from '@/lib/utils';

// ===== キャンペーン集計モックデータ =====
interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  status: 'ENABLED' | 'PAUSED';
  // 基本指標
  clicks: number;
  impressions: number;
  cost: number;
  // 7つの主要指標
  ctr: number;
  cpc: number;
  qualityScore: number | null;
  conversions: number;
  costPerConversion: number | null;
  searchImpressionShare: number | null;
  conversionRate: number | null;
}

const MOCK_CAMPAIGNS: CampaignMetrics[] = [
  {
    campaignId: '12345678901',
    campaignName: '整体院 検索キャンペーン',
    status: 'ENABLED',
    clicks: 2498,
    impressions: 46840,
    cost: 405216,
    ctr: 0.0533,
    cpc: 162,
    qualityScore: 7,
    conversions: 83,
    costPerConversion: 4882,
    searchImpressionShare: 0.58,
    conversionRate: 0.033,
  },
  {
    campaignId: '12345678902',
    campaignName: 'マッサージ キャンペーン',
    status: 'ENABLED',
    clicks: 333,
    impressions: 4680,
    cost: 61938,
    ctr: 0.0712,
    cpc: 186,
    qualityScore: 7,
    conversions: 15,
    costPerConversion: 4129,
    searchImpressionShare: 0.62,
    conversionRate: 0.045,
  },
  {
    campaignId: '12345678903',
    campaignName: 'スポーツ整体キャンペーン',
    status: 'ENABLED',
    clicks: 289,
    impressions: 4260,
    cost: 65025,
    ctr: 0.0678,
    cpc: 225,
    qualityScore: 8,
    conversions: 11,
    costPerConversion: 5911,
    searchImpressionShare: 0.55,
    conversionRate: 0.038,
  },
  {
    campaignId: '12345678904',
    campaignName: 'リピーター向けキャンペーン',
    status: 'PAUSED',
    clicks: 0,
    impressions: 0,
    cost: 0,
    ctr: 0,
    cpc: 0,
    qualityScore: null,
    conversions: 0,
    costPerConversion: null,
    searchImpressionShare: null,
    conversionRate: null,
  },
];

// 集計値を計算
const summary = {
  totalClicks: MOCK_CAMPAIGNS.reduce((sum, c) => sum + c.clicks, 0),
  totalImpressions: MOCK_CAMPAIGNS.reduce((sum, c) => sum + c.impressions, 0),
  totalCost: MOCK_CAMPAIGNS.reduce((sum, c) => sum + c.cost, 0),
  totalConversions: MOCK_CAMPAIGNS.reduce((sum, c) => sum + c.conversions, 0),
  get avgCtr() {
    return this.totalImpressions > 0 ? this.totalClicks / this.totalImpressions : 0;
  },
  get avgCpc() {
    return this.totalClicks > 0 ? this.totalCost / this.totalClicks : 0;
  },
  get avgConversionRate() {
    return this.totalClicks > 0 ? this.totalConversions / this.totalClicks : 0;
  },
  get avgCostPerConversion() {
    return this.totalConversions > 0 ? this.totalCost / this.totalConversions : 0;
  },
  // 検索インプレッションシェア（有効キャンペーンの平均）
  get avgSearchImpressionShare() {
    const enabled = MOCK_CAMPAIGNS.filter(
      (c) => c.status === 'ENABLED' && c.searchImpressionShare !== null
    );
    if (enabled.length === 0) return null;
    return enabled.reduce((sum, c) => sum + (c.searchImpressionShare ?? 0), 0) / enabled.length;
  },
};

export default function GoogleAdsDashboardPage() {
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
            連携済みアカウントの広告パフォーマンス概要（モックデータ）
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" disabled>
            期間: 過去30日間
          </Button>
        </div>
      </div>

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

      {/* Campaigns Table */}
      <Card>
        <CardHeader>
          <CardTitle>キャンペーン一覧</CardTitle>
          <CardDescription>
            取得されたキャンペーンデータがここに表示されます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>キャンペーン名</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead className="text-right">クリック数</TableHead>
                  <TableHead className="text-right">表示回数</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">CPC</TableHead>
                  <TableHead className="text-right">費用</TableHead>
                  <TableHead className="text-right">CV数</TableHead>
                  <TableHead className="text-right">CVR</TableHead>
                  <TableHead className="text-right">CPA</TableHead>
                  <TableHead className="text-right">検索IS</TableHead>
                  <TableHead className="text-right">品質</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_CAMPAIGNS.map((campaign) => (
                  <TableRow key={campaign.campaignId}>
                    <TableCell className="font-medium">{campaign.campaignName}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          campaign.status === 'ENABLED'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {campaign.status === 'ENABLED' ? '有効' : '一時停止'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(campaign.clicks)}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(campaign.impressions)}
                    </TableCell>
                    <TableCell className="text-right">{formatPercent(campaign.ctr)}</TableCell>
                    <TableCell className="text-right">
                      {campaign.cpc > 0 ? formatCurrency(campaign.cpc) : '-'}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(campaign.cost)}</TableCell>
                    <TableCell className="text-right">{campaign.conversions}</TableCell>
                    <TableCell className="text-right">
                      {formatPercent(campaign.conversionRate)}
                    </TableCell>
                    <TableCell className="text-right">
                      {campaign.costPerConversion ? formatCurrency(campaign.costPerConversion) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercent(campaign.searchImpressionShare)}
                    </TableCell>
                    <TableCell className="text-right">
                      {campaign.qualityScore !== null ? (
                        <span
                          className={`font-medium ${
                            campaign.qualityScore >= 7
                              ? 'text-green-600'
                              : campaign.qualityScore >= 5
                                ? 'text-yellow-600'
                                : 'text-red-600'
                          }`}
                        >
                          {campaign.qualityScore}/10
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
