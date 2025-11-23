'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

type DetailResponse = {
  success: boolean;
  data?: {
    annotation: { id: string; wp_post_title: string | null; canonical_url: string | null };
    metrics: Array<{
      date: string;
      position: number | null;
      ctr: number | null;
      clicks: number | null;
      impressions: number | null;
    }>;
    history: Array<{
      id: string;
      evaluation_date: string;
      stage: number;
      previous_position: number | null;
      current_position: number;
      outcome: string;
    }>;
  };
  error?: string;
};

export default function GscDashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResponse['data'] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedFromUrl = searchParams.get('annotationId');
  const [visibleMetrics, setVisibleMetrics] = useState({
    clicks: true,
    impressions: true,
    ctr: true,
    position: true,
  });

  // sync selection from query
  useEffect(() => {
    if (selectedFromUrl) {
      setSelectedId(selectedFromUrl);
    }
  }, [selectedFromUrl]);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!selectedId) {
        setDetail(null);
        return;
      }
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/gsc/dashboard/${selectedId}`, { cache: 'no-store' });
        const json = (await res.json()) as DetailResponse;
        if (!json.success) {
          throw new Error(json.error || '詳細の取得に失敗しました');
        }
        setDetail(json.data ?? null);
      } catch (err) {
        setDetail(null);
        setError(err instanceof Error ? err.message : '詳細の取得に失敗しました');
      } finally {
        setDetailLoading(false);
      }
    };
    fetchDetail();
  }, [selectedId]);

  const chartData = useMemo(() => {
    if (!detail?.metrics) return [];
    return detail.metrics.map(m => ({
      date: m.date,
      position: m.position ?? null,
      ctr: m.ctr != null ? Math.round(m.ctr * 10000) / 100 : null, // to %
      clicks: m.clicks ?? null,
      impressions: m.impressions ?? null,
    }));
  }, [detail]);

  const metricsSummary = useMemo(() => {
    if (!detail?.metrics || detail.metrics.length === 0) return null;

    const totalClicks = detail.metrics.reduce((sum, m) => sum + (m.clicks || 0), 0);
    const totalImpressions = detail.metrics.reduce((sum, m) => sum + (m.impressions || 0), 0);

    const validCtrs = detail.metrics.filter(m => m.ctr != null);
    const avgCtr = validCtrs.length
      ? validCtrs.reduce((sum, m) => sum + (m.ctr || 0), 0) / validCtrs.length
      : 0;

    const validPositions = detail.metrics.filter(m => m.position != null);
    const avgPosition = validPositions.length
      ? validPositions.reduce((sum, m) => sum + (m.position || 0), 0) / validPositions.length
      : 0;

    return {
      clicks: totalClicks,
      impressions: totalImpressions,
      ctr: avgCtr,
      position: avgPosition,
    };
  }, [detail]);

  const toggleMetric = (key: keyof typeof visibleMetrics) => {
    setVisibleMetrics(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="w-full px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-3xl font-bold">Google Search Console ダッシュボード</h1>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6">
        <Card className="min-h-[520px]">
          <CardHeader>
            <CardTitle>記事詳細</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {detailLoading ? (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" /> 読み込み中...
              </div>
            ) : detail ? (
              <>
                <div>
                  <p className="text-sm text-gray-600">タイトル</p>
                  <p className="font-semibold">{detail.annotation.wp_post_title || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">URL</p>
                  <p className="text-sm text-blue-700 break-all">
                    {detail.annotation.canonical_url || '—'}
                  </p>
                </div>

                {metricsSummary && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 select-none">
                    <div
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        visibleMetrics.clicks
                          ? 'bg-green-50 border-green-500 ring-1 ring-green-500 shadow-sm'
                          : 'bg-white border-gray-200 hover:border-green-300'
                      }`}
                      onClick={() => toggleMetric('clicks')}
                    >
                      <p className="text-xs text-gray-500 mb-1">合計クリック数</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {metricsSummary.clicks.toLocaleString()}
                      </p>
                    </div>

                    <div
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        visibleMetrics.impressions
                          ? 'bg-fuchsia-50 border-fuchsia-500 ring-1 ring-fuchsia-500 shadow-sm'
                          : 'bg-white border-gray-200 hover:border-fuchsia-300'
                      }`}
                      onClick={() => toggleMetric('impressions')}
                    >
                      <p className="text-xs text-gray-500 mb-1">合計表示回数</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {metricsSummary.impressions.toLocaleString()}
                      </p>
                    </div>

                    <div
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        visibleMetrics.ctr
                          ? 'bg-orange-50 border-orange-500 ring-1 ring-orange-500 shadow-sm'
                          : 'bg-white border-gray-200 hover:border-orange-300'
                      }`}
                      onClick={() => toggleMetric('ctr')}
                    >
                      <p className="text-xs text-gray-500 mb-1">平均 CTR</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {(metricsSummary.ctr * 100).toFixed(1)}%
                      </p>
                    </div>

                    <div
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        visibleMetrics.position
                          ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 shadow-sm'
                          : 'bg-white border-gray-200 hover:border-blue-300'
                      }`}
                      onClick={() => toggleMetric('position')}
                    >
                      <p className="text-xs text-gray-500 mb-1">平均掲載順位</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {metricsSummary.position.toFixed(1)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />

                      {visibleMetrics.clicks && (
                        <YAxis
                          yAxisId="clicks"
                          orientation="left"
                          stroke="#16a34a"
                          tickFormatter={v => (v != null ? Number(v).toFixed(0) : '')}
                          label={{
                            value: 'クリック数',
                            angle: -90,
                            position: 'insideLeft',
                            fill: '#16a34a',
                            offset: 10,
                          }}
                        />
                      )}
                      {visibleMetrics.impressions && (
                        <YAxis
                          yAxisId="impressions"
                          orientation="left"
                          hide={visibleMetrics.clicks} // クリック数表示中は軸を隠す（スケール独立）
                          stroke="#c026d3"
                          domain={[0, 'dataMax']}
                        />
                      )}

                      {visibleMetrics.position && (
                        <YAxis
                          yAxisId="position"
                          orientation="right"
                          reversed
                          stroke="#2563eb"
                          tickFormatter={v => (v != null ? Number(v).toFixed(0) : '')}
                          label={{
                            value: '掲載順位',
                            angle: 90,
                            position: 'insideRight',
                            fill: '#2563eb',
                            offset: 10,
                          }}
                          domain={['dataMin', 'dataMax']}
                        />
                      )}
                      {visibleMetrics.ctr && (
                        <YAxis
                          yAxisId="ctr"
                          orientation="right"
                          hide={visibleMetrics.position} // 順位表示中は軸を隠す（スケール独立）
                          stroke="#f97316"
                          domain={[0, 'dataMax']}
                        />
                      )}

                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === 'CTR(%)') return [value.toFixed(2) + '%', name];
                          return [value, name];
                        }}
                      />
                      <Legend />

                      {visibleMetrics.clicks && (
                        <Line
                          yAxisId="clicks"
                          type="monotone"
                          dataKey="clicks"
                          name="クリック数"
                          stroke="#16a34a"
                          dot={false}
                          strokeWidth={2}
                        />
                      )}
                      {visibleMetrics.impressions && (
                        <Line
                          yAxisId="impressions"
                          type="monotone"
                          dataKey="impressions"
                          name="表示回数"
                          stroke="#c026d3"
                          dot={false}
                          strokeWidth={2}
                        />
                      )}
                      {visibleMetrics.ctr && (
                        <Line
                          yAxisId="ctr"
                          type="monotone"
                          dataKey="ctr"
                          name="CTR(%)"
                          stroke="#f97316"
                          dot={false}
                          strokeWidth={2}
                        />
                      )}
                      {visibleMetrics.position && (
                        <Line
                          yAxisId="position"
                          type="monotone"
                          dataKey="position"
                          name="掲載順位"
                          stroke="#2563eb"
                          dot={false}
                          strokeWidth={2}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-sm font-semibold mb-2">評価履歴</p>
                  <div className="max-h-48 overflow-auto space-y-2 text-sm">
                    {detail.history.length === 0 && <p className="text-gray-500">履歴なし</p>}
                    {detail.history.map(h => (
                      <div key={h.id} className="p-2 rounded border border-gray-200">
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>{h.evaluation_date}</span>
                          <span>ステージ{h.stage}</span>
                        </div>
                        <div className="text-gray-800">
                          Outcome: {h.outcome} / {h.previous_position ?? '—'} → {h.current_position}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2 text-gray-600">
                <p>annotationId をクエリに指定してアクセスしてください。</p>
                <p className="text-sm">
                  例: /gsc-dashboard?annotationId=&lt;content_annotation_id&gt;
                  （Analyticsの「詳細」ボタンから遷移可）
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => router.push('/analytics')}>
                    Analyticsへ戻る
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
