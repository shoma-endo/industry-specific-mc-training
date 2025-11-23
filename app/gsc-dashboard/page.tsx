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

  return (
    <div className="w-full px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-3xl font-bold">Google Search Console ダッシュボード</h1>
        <Button variant="outline" onClick={() => router.push('/gsc-import')}>
          Google Search Console インポートへ
        </Button>
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
                <div className="flex gap-2"></div>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      {/* Left Axis: Clicks (Visible) */}
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
                      {/* Left Axis: Impressions (Hidden, independent scale) */}
                      <YAxis
                        yAxisId="impressions"
                        orientation="left"
                        hide
                        domain={[0, 'dataMax']}
                      />
                      {/* Right Axis: Position (Visible, Reversed) */}
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
                      {/* Right Axis: CTR (Hidden, independent scale) */}
                      <YAxis yAxisId="ctr" orientation="right" hide domain={[0, 'dataMax']} />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === 'CTR(%)') return [value.toFixed(2) + '%', name];
                          return [value, name];
                        }}
                      />
                      <Legend />
                      <Line
                        yAxisId="clicks"
                        type="monotone"
                        dataKey="clicks"
                        name="クリック数"
                        stroke="#16a34a"
                        dot={false}
                        strokeWidth={2}
                      />
                      <Line
                        yAxisId="impressions"
                        type="monotone"
                        dataKey="impressions"
                        name="表示回数"
                        stroke="#c026d3"
                        dot={false}
                        strokeWidth={2}
                      />
                      <Line
                        yAxisId="ctr"
                        type="monotone"
                        dataKey="ctr"
                        name="CTR(%)"
                        stroke="#f97316"
                        dot={false}
                        strokeWidth={2}
                      />
                      <Line
                        yAxisId="position"
                        type="monotone"
                        dataKey="position"
                        name="掲載順位"
                        stroke="#2563eb"
                        dot={false}
                        strokeWidth={2}
                      />
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
