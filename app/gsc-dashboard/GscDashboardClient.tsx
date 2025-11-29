'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, ArrowLeft, ChevronRight } from 'lucide-react';
import {
  fetchGscDetail,
  registerEvaluation,
  updateEvaluation,
} from '@/server/actions/gscDashboard.actions';
import { EvaluationSettings } from './EvaluationSettings';
import {
  GSC_EVALUATION_OUTCOME_CONFIG,
  GscEvaluationOutcome,
} from '@/types/googleSearchConsole';

type DetailResponse = {
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
    previous_position: number | null;
    current_position: number;
    outcome: GscEvaluationOutcome;
    suggestion_summary: string | null;
  }>;
  evaluation: {
    id: string;
    user_id: string;
    content_annotation_id: string;
    property_uri: string;
    last_evaluated_on: string | null;
    base_evaluation_date: string;
    cycle_days: number;
    last_seen_position: number | null;
    status: string;
    created_at: string;
    updated_at: string;
  } | null;
  credential: {
    propertyUri: string | null;
  } | null;
};

interface Props {
  initialSelectedId?: string | null;
  initialDetail?: DetailResponse | null;
}

export default function GscDashboardClient({
  initialSelectedId = null,
  initialDetail = null,
}: Props) {
  const searchParams = useSearchParams();

  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [detail, setDetail] = useState<DetailResponse | null>(initialDetail);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedFromUrl = searchParams.get('annotationId');
  const [visibleMetrics, setVisibleMetrics] = useState({
    clicks: true,
    impressions: true,
    ctr: true,
    position: true,
  });
  const [selectedHistory, setSelectedHistory] = useState<{
    id: string;
    evaluation_date: string;
    previous_position: number | null;
    current_position: number;
    outcome: GscEvaluationOutcome;
    suggestion_summary: string | null;
  } | null>(null);

  // URLのクエリから選択を同期
  useEffect(() => {
    if (selectedFromUrl) {
      setSelectedId(selectedFromUrl);
    }
  }, [selectedFromUrl]);

  // 詳細取得
  useEffect(() => {
    const run = async () => {
      if (!selectedId) {
        setDetail(null);
        return;
      }
      setDetailLoading(true);
      setError(null);
      try {
        const res = await fetchGscDetail(selectedId);
        if (!res.success) {
          throw new Error(res.error || '詳細の取得に失敗しました');
        }
        setDetail(res.data ?? null);
      } catch (err) {
        setDetail(null);
        setError(err instanceof Error ? err.message : '詳細の取得に失敗しました');
      } finally {
        setDetailLoading(false);
      }
    };
    // 初期データがあれば最初のレンダリングで即時フェッチを避ける
    if (initialDetail && initialDetail.annotation.id === selectedId) {
      return;
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const refreshDetail = async (annotationId: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const res = await fetchGscDetail(annotationId);
      if (!res.success) {
        throw new Error(res.error || '詳細の取得に失敗しました');
      }
      setDetail(res.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '詳細の取得に失敗しました');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRegisterEvaluation = async (dateStr: string, cycleDays: number) => {
    if (!selectedId || !detail?.credential?.propertyUri) return;

    const res = await registerEvaluation({
      contentAnnotationId: selectedId,
      propertyUri: detail.credential.propertyUri,
      baseEvaluationDate: dateStr,
      cycleDays,
    });

    if (!res.success) {
      throw new Error(res.error || '評価対象の登録に失敗しました');
    }

    // データリロード
    await refreshDetail(selectedId);
  };

  const handleUpdateEvaluation = async (dateStr: string, cycleDays: number) => {
    if (!selectedId) return;

    const res = await updateEvaluation({
      contentAnnotationId: selectedId,
      baseEvaluationDate: dateStr,
      cycleDays,
    });

    if (!res.success) {
      throw new Error(res.error || '評価日の更新に失敗しました');
    }

    // データリロード
    await refreshDetail(selectedId);
  };

  return (
    <div className="w-full px-4 py-8 space-y-6">
      <div className="space-y-4">
        <Link
          href="/analytics"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          コンテンツ一覧に戻る
        </Link>
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
            <CardTitle className="text-lg">記事詳細</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {detailLoading ? (
              <div className="flex items-center gap-2 text-gray-500 py-10 justify-center">
                <Loader2 className="w-6 h-6 animate-spin" /> 読み込み中...
              </div>
            ) : detail ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">タイトル</p>
                    <p className="font-semibold text-lg">
                      {detail.annotation.wp_post_title || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">URL</p>
                    <p className="text-sm text-blue-700 break-all bg-blue-50/50 p-2 rounded">
                      {detail.annotation.canonical_url || '—'}
                    </p>
                  </div>
                </div>

                {metricsSummary && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 select-none">
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

                <div className="h-80 w-full mt-4">
                  <ResponsiveContainer>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} tickMargin={10} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: 'none',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        }}
                      />
                      <Legend />
                      {visibleMetrics.clicks && (
                        <Line
                          type="monotone"
                          dataKey="clicks"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={false}
                          name="クリック"
                        />
                      )}
                      {visibleMetrics.impressions && (
                        <Line
                          type="monotone"
                          dataKey="impressions"
                          stroke="#a855f7"
                          strokeWidth={2}
                          dot={false}
                          name="表示回数"
                        />
                      )}
                      {visibleMetrics.ctr && (
                        <Line
                          type="monotone"
                          dataKey="ctr"
                          stroke="#fb923c"
                          strokeWidth={2}
                          dot={false}
                          name="CTR(%)"
                        />
                      )}
                      {visibleMetrics.position && (
                        <Line
                          type="monotone"
                          dataKey="position"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={false}
                          name="掲載順位"
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* 評価設定（コンポーネント化） */}
                {detail.credential?.propertyUri && (
                  <EvaluationSettings
                    currentEvaluation={detail.evaluation}
                    onRegister={handleRegisterEvaluation}
                    onUpdate={handleUpdateEvaluation}
                  />
                )}

                <div className="border-t pt-6">
                  <p className="text-lg font-semibold mb-4">評価履歴</p>
                  {detail.history.length === 0 ? (
                    <p className="text-sm text-gray-500">まだ評価履歴がありません</p>
                  ) : (
                    <div className="space-y-3">
                      {detail.history.map(item => (
                        <div
                          key={item.id}
                          className="group p-4 rounded-lg border bg-white flex items-center justify-between shadow-sm cursor-pointer hover:bg-gray-50 hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
                          onClick={() => setSelectedHistory(item)}
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {item.evaluation_date}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500">判定:</span>
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ring-gray-500/10 ${GSC_EVALUATION_OUTCOME_CONFIG[item.outcome].className}`}
                              >
                                {GSC_EVALUATION_OUTCOME_CONFIG[item.outcome].label}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="flex items-baseline gap-2 justify-end">
                                <span className="text-xs text-gray-500">
                                  前回: {item.previous_position ?? '—'}
                                </span>
                                <span className="text-gray-400">→</span>
                                <span className="text-lg font-bold text-gray-900">
                                  {item.current_position}
                                </span>
                                <span className="text-xs text-gray-500">位</span>
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-200" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="py-20 text-center text-gray-500">
                <p>左側のリストまたはURLから記事を選択してください</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 評価履歴詳細Dialog */}
      <Dialog open={selectedHistory !== null} onOpenChange={(open) => !open && setSelectedHistory(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AIの改善提案内容</DialogTitle>
          </DialogHeader>
          {selectedHistory && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500 mb-1">評価日</p>
                  <p className="text-sm font-medium">{selectedHistory.evaluation_date}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">判定</p>
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ring-gray-500/10 ${GSC_EVALUATION_OUTCOME_CONFIG[selectedHistory.outcome].className}`}
                  >
                    {GSC_EVALUATION_OUTCOME_CONFIG[selectedHistory.outcome].label}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">前回順位</p>
                  <p className="text-sm font-medium">{selectedHistory.previous_position ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">現在順位</p>
                  <p className="text-sm font-medium">{selectedHistory.current_position}位</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">改善提案</p>
                {selectedHistory.suggestion_summary ? (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                      {selectedHistory.suggestion_summary}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">提案なし</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
