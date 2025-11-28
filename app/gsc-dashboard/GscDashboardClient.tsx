'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { fetchGscDetail, registerEvaluation, updateEvaluation } from '@/server/actions/gscDashboard.actions';

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
    outcome: string;
  }>;
  evaluation: {
    id: string;
    user_id: string;
    content_annotation_id: string;
    property_uri: string;
    last_evaluated_on: string | null;
    base_evaluation_date: string;
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

export default function GscDashboardClient({ initialSelectedId = null, initialDetail = null }: Props) {
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

  // 評価開始フォームの状態
  const [nextEvaluationOn, setNextEvaluationOn] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  // 評価日編集の状態
  const [isEditingEvaluation, setIsEditingEvaluation] = useState(false);
  const [editEvaluationDate, setEditEvaluationDate] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);

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

  const getDefaultEvaluationDate = () => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 30);
    return d.toISOString().slice(0, 10);
  };

  const getTodayISO = () => new Date().toISOString().slice(0, 10);

  const calculateNextEvaluationDate = (evaluation: {
    base_evaluation_date: string;
    last_evaluated_on: string | null;
  } | null): string => {
    if (!evaluation) return '';
    const referenceDate = evaluation.last_evaluated_on || evaluation.base_evaluation_date;
    const date = new Date(`${referenceDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + 30);
    return date.toISOString().slice(0, 10);
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

  const handleRegisterEvaluation = async () => {
    if (!selectedId || !detail?.credential?.propertyUri || !nextEvaluationOn) {
      setError('必要な情報が不足しています');
      return;
    }

    setRegisterLoading(true);
    setRegisterSuccess(false);
    setError(null);

    try {
      const res = await registerEvaluation({
        contentAnnotationId: selectedId,
        propertyUri: detail.credential.propertyUri,
        baseEvaluationDate: nextEvaluationOn,
      });

      if (!res.success) {
        throw new Error(res.error || '評価対象の登録に失敗しました');
      }

      setRegisterSuccess(true);
      await refreshDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '評価対象の登録に失敗しました');
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleStartEditEvaluation = () => {
    if (detail?.evaluation?.base_evaluation_date) {
      setEditEvaluationDate(detail.evaluation.base_evaluation_date);
      setIsEditingEvaluation(true);
      setUpdateSuccess(false);
    }
  };

  const handleCancelEditEvaluation = () => {
    setIsEditingEvaluation(false);
    setEditEvaluationDate('');
    setUpdateSuccess(false);
  };

  const handleUpdateEvaluation = async () => {
    if (!selectedId || !editEvaluationDate) {
      setError('必要な情報が不足しています');
      return;
    }

    setUpdateLoading(true);
    setUpdateSuccess(false);
    setError(null);

    try {
      const res = await updateEvaluation({
        contentAnnotationId: selectedId,
        baseEvaluationDate: editEvaluationDate,
      });

      if (!res.success) {
        throw new Error(res.error || '評価日の更新に失敗しました');
      }

      setUpdateSuccess(true);
      setIsEditingEvaluation(false);
      await refreshDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '評価日の更新に失敗しました');
    } finally {
      setUpdateLoading(false);
    }
  };

  useEffect(() => {
    if (detail && !detail.evaluation && !nextEvaluationOn) {
      setNextEvaluationOn(getDefaultEvaluationDate());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

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

                {!detail.evaluation && detail.credential?.propertyUri ? (
                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm font-semibold mb-3">評価開始</p>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label htmlFor="nextEvaluationOn" className="text-sm font-medium text-gray-700">
                          評価基準日（この日付 + 30日が初回評価日になります）
                        </label>
                        <Input
                          id="nextEvaluationOn"
                          type="date"
                          value={nextEvaluationOn}
                          min={getTodayISO()}
                          onChange={e => setNextEvaluationOn(e.target.value)}
                          className="max-w-xs"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <Button onClick={handleRegisterEvaluation} disabled={registerLoading}>
                          {registerLoading ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              登録中...
                            </span>
                          ) : (
                            '評価を開始'
                          )}
                        </Button>
                        {registerSuccess && (
                          <span className="flex items-center text-sm text-green-700 gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            登録しました
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* 評価情報の表示と編集 */}
                {detail.evaluation && (
                  <div className="border-t pt-4 mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">評価基準日</p>
                        <p className="font-semibold">{detail.evaluation.base_evaluation_date}</p>
                      </div>
                      {!isEditingEvaluation ? (
                        <Button variant="outline" onClick={handleStartEditEvaluation}>
                          評価日を編集
                        </Button>
                      ) : null}
                    </div>

                    {detail.evaluation.last_evaluated_on && (
                      <div>
                        <p className="text-sm text-gray-600">最終評価日</p>
                        <p className="font-semibold">{detail.evaluation.last_evaluated_on}</p>
                      </div>
                    )}

                    {isEditingEvaluation && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label htmlFor="editEvaluationDate" className="text-sm font-medium text-gray-700">
                            評価基準日を変更
                          </label>
                          <Input
                            id="editEvaluationDate"
                            type="date"
                            value={editEvaluationDate}
                            onChange={e => setEditEvaluationDate(e.target.value)}
                            className="max-w-xs"
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <Button onClick={handleUpdateEvaluation} disabled={updateLoading}>
                            {updateLoading ? (
                              <span className="inline-flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                更新中...
                              </span>
                            ) : (
                              '保存'
                            )}
                          </Button>
                          <Button variant="ghost" onClick={handleCancelEditEvaluation}>
                            キャンセル
                          </Button>
                          {updateSuccess && (
                            <span className="flex items-center text-sm text-green-700 gap-1">
                              <CheckCircle2 className="w-4 h-4" />
                              更新しました
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm text-gray-600">次回評価予定</p>
                        <p className="font-semibold">
                          {calculateNextEvaluationDate(detail.evaluation) || '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="border-t pt-4 mt-4">
                  <p className="text-sm font-semibold mb-3">メトリクス</p>
                  <div className="w-full h-96">
                    <ResponsiveContainer>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        {visibleMetrics.clicks && (
                          <Line type="monotone" dataKey="clicks" stroke="#22c55e" name="クリック" />
                        )}
                        {visibleMetrics.impressions && (
                          <Line
                            type="monotone"
                            dataKey="impressions"
                            stroke="#a855f7"
                            name="表示回数"
                          />
                        )}
                        {visibleMetrics.ctr && (
                          <Line type="monotone" dataKey="ctr" stroke="#fb923c" name="CTR(%)" />
                        )}
                        {visibleMetrics.position && (
                          <Line type="monotone" dataKey="position" stroke="#3b82f6" name="掲載順位" />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="border-t pt-4 mt-4 space-y-3">
                  <p className="text-sm font-semibold">評価履歴</p>
                  {detail.history.length === 0 ? (
                    <p className="text-sm text-gray-600">評価履歴がありません</p>
                  ) : (
                    <div className="space-y-2">
                      {detail.history.map(item => (
                        <div
                          key={item.id}
                          className="p-3 rounded-lg border flex items-center justify-between"
                        >
                          <div>
                            <p className="text-sm font-medium">{item.evaluation_date}</p>
                            <p className="text-xs text-gray-600">結果: {item.outcome}</p>
                          </div>
                          <div className="text-sm text-gray-700">
                            <p>前回順位: {item.previous_position ?? '—'}</p>
                            <p>今回順位: {item.current_position}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-600">記事が選択されていません</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
