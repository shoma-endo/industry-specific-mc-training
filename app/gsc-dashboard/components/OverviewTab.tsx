'use client';

import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { EvaluationSettings } from '../EvaluationSettings';
import { MetricsSummaryCards } from './MetricsSummaryCards';
import { TrendLineChart } from './TrendLineChart';
import type {
  GscDashboardDetailResponse,
  GscMetricsSummary,
  GscVisibleMetrics,
  GscChartDataPoint,
} from '../types';

interface OverviewTabProps {
  detail: GscDashboardDetailResponse | null;
  detailLoading: boolean;
  chartData: GscChartDataPoint[];
  metricsSummary: GscMetricsSummary | null;
  visibleMetrics: GscVisibleMetrics;
  onToggleMetric: (key: keyof GscVisibleMetrics) => void;
  onRegisterEvaluation: (dateStr: string, cycleDays: number, evaluationHour: number) => Promise<void>;
  onUpdateEvaluation: (dateStr: string, cycleDays: number, evaluationHour: number) => Promise<void>;
}

export function OverviewTab({
  detail,
  detailLoading,
  chartData,
  metricsSummary,
  visibleMetrics,
  onToggleMetric,
  onRegisterEvaluation,
  onUpdateEvaluation,
}: OverviewTabProps) {
  if (detailLoading) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex items-center gap-2 text-gray-500 justify-center">
            <Loader2 className="w-6 h-6 animate-spin" /> 読み込み中...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!detail) {
    return (
      <Card>
        <CardContent className="py-20 text-center text-gray-500">
          <p>URLパラメータから記事を選択してください</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        {/* 記事情報 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">タイトル</p>
            <p className="font-semibold text-lg">{detail.annotation.wp_post_title || '—'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">URL</p>
            <p className="text-sm text-blue-700 break-all bg-blue-50/50 p-2 rounded">
              {detail.annotation.canonical_url || '—'}
            </p>
          </div>
        </div>

        {/* メトリクスカード */}
        {metricsSummary && (
          <MetricsSummaryCards
            summary={metricsSummary}
            visibleMetrics={visibleMetrics}
            onToggle={onToggleMetric}
          />
        )}

        {/* 時系列グラフ */}
        <TrendLineChart data={chartData} visibleMetrics={visibleMetrics} />

        {/* 評価設定 */}
        {detail.credential?.propertyUri && (
          <EvaluationSettings
            currentEvaluation={detail.evaluation}
            onRegister={onRegisterEvaluation}
            onUpdate={onUpdateEvaluation}
          />
        )}
      </CardContent>
    </Card>
  );
}

