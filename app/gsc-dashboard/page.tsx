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
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2 } from 'lucide-react';

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

  // 評価開始フォームの状態
  const [nextEvaluationOn, setNextEvaluationOn] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  // 評価日編集の状態
  const [isEditingEvaluation, setIsEditingEvaluation] = useState(false);
  const [editEvaluationDate, setEditEvaluationDate] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);

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

  // 今日から30日後の日付を計算
  const getDefaultEvaluationDate = () => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 30);
    return d.toISOString().slice(0, 10);
  };

  // 今日の日付を取得
  const getTodayISO = () => new Date().toISOString().slice(0, 10);

  // 次回評価日を計算
  const calculateNextEvaluationDate = (evaluation: {
    base_evaluation_date: string;
    last_evaluated_on: string | null;
  } | null): string => {
    if (!evaluation) return '';

    // 初回（last_evaluated_on が null）: base_evaluation_date + 30日
    // 2回目以降: last_evaluated_on + 30日
    const referenceDate = evaluation.last_evaluated_on || evaluation.base_evaluation_date;
    const date = new Date(`${referenceDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + 30);
    return date.toISOString().slice(0, 10);
  };

  // 評価開始処理
  const handleRegisterEvaluation = async () => {
    if (!selectedId || !detail?.credential?.propertyUri || !nextEvaluationOn) {
      setError('必要な情報が不足しています');
      return;
    }

    setRegisterLoading(true);
    setRegisterSuccess(false);
    setError(null);

    try {
      const res = await fetch('/api/gsc/evaluations/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentAnnotationId: selectedId,
          propertyUri: detail.credential.propertyUri,
          baseEvaluationDate: nextEvaluationOn,
        }),
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || '評価対象の登録に失敗しました');
      }

      setRegisterSuccess(true);

      // 詳細データを再取得して評価情報を更新
      const detailRes = await fetch(`/api/gsc/dashboard/${selectedId}`, { cache: 'no-store' });
      const detailJson = (await detailRes.json()) as DetailResponse;
      if (detailJson.success) {
        setDetail(detailJson.data ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '評価対象の登録に失敗しました');
    } finally {
      setRegisterLoading(false);
    }
  };

  // 評価日の編集開始
  const handleStartEditEvaluation = () => {
    if (detail?.evaluation?.base_evaluation_date) {
      setEditEvaluationDate(detail.evaluation.base_evaluation_date);
      setIsEditingEvaluation(true);
      setUpdateSuccess(false);
    }
  };

  // 評価日の編集キャンセル
  const handleCancelEditEvaluation = () => {
    setIsEditingEvaluation(false);
    setEditEvaluationDate('');
    setUpdateSuccess(false);
  };

  // 評価日の更新処理
  const handleUpdateEvaluation = async () => {
    if (!selectedId || !editEvaluationDate) {
      setError('必要な情報が不足しています');
      return;
    }

    setUpdateLoading(true);
    setUpdateSuccess(false);
    setError(null);

    try {
      const res = await fetch('/api/gsc/evaluations/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentAnnotationId: selectedId,
          baseEvaluationDate: editEvaluationDate,
        }),
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || '評価日の更新に失敗しました');
      }

      setUpdateSuccess(true);
      setIsEditingEvaluation(false);

      // 詳細データを再取得して評価情報を更新
      const detailRes = await fetch(`/api/gsc/dashboard/${selectedId}`, { cache: 'no-store' });
      const detailJson = (await detailRes.json()) as DetailResponse;
      if (detailJson.success) {
        setDetail(detailJson.data ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '評価日の更新に失敗しました');
    } finally {
      setUpdateLoading(false);
    }
  };

  // 詳細データ取得時にデフォルト評価日を設定
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

                {/* 評価開始フォーム */}
                {!detail.evaluation && detail.credential?.propertyUri ? (
                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm font-semibold mb-3">評価開始</p>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label htmlFor="nextEvaluationOn" className="text-sm font-medium text-gray-700">
                          評価基準日（この日付 + 30日が初回評価日になります）
                        </label>
                        <div className="flex items-center gap-3">
                          <Input
                            id="nextEvaluationOn"
                            type="date"
                            value={nextEvaluationOn}
                            min={getTodayISO()}
                            onChange={e => setNextEvaluationOn(e.target.value)}
                            disabled={registerLoading}
                            className="w-[250px]"
                          />
                          <Button
                            onClick={handleRegisterEvaluation}
                            disabled={registerLoading || !nextEvaluationOn}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            {registerLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                登録中...
                              </>
                            ) : (
                              '評価開始'
                            )}
                          </Button>
                        </div>
                      </div>
                      {registerSuccess && (
                        <Alert>
                          <CheckCircle2 className="h-4 w-4" />
                          <AlertDescription>評価対象として登録しました</AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                ) : detail.evaluation ? (
                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm font-semibold mb-2">評価ステータス</p>
                    {isEditingEvaluation ? (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label htmlFor="editEvaluationDate" className="text-sm font-medium text-gray-700">
                            評価基準日
                          </label>
                          <div className="flex items-center gap-3">
                            <Input
                              id="editEvaluationDate"
                              type="date"
                              value={editEvaluationDate}
                              min={getTodayISO()}
                              onChange={e => setEditEvaluationDate(e.target.value)}
                              disabled={updateLoading}
                              className="w-[250px]"
                            />
                            <Button
                              onClick={handleUpdateEvaluation}
                              disabled={updateLoading || !editEvaluationDate}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              {updateLoading ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  保存中...
                                </>
                              ) : (
                                '保存'
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={handleCancelEditEvaluation}
                              disabled={updateLoading}
                            >
                              キャンセル
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-1 text-sm text-gray-700">
                          <p>
                            次回評価日:{' '}
                            <span className="font-medium">
                              {calculateNextEvaluationDate(detail.evaluation)}
                            </span>
                            {' '}
                            <span className="text-xs text-gray-500">
                              （評価基準日: {detail.evaluation.base_evaluation_date}）
                            </span>
                          </p>
                          <p>
                            ステータス: <span className="font-medium">{detail.evaluation.status}</span>
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleStartEditEvaluation}
                        >
                          評価日を編集
                        </Button>
                        {updateSuccess && (
                          <Alert>
                            <CheckCircle2 className="h-4 w-4" />
                            <AlertDescription>評価日を更新しました</AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="h-96 mt-6">
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

                <div className="border-t pt-4 mt-4">
                  <p className="text-sm font-semibold mb-2">評価履歴</p>
                  <div className="max-h-48 overflow-auto space-y-2 text-sm">
                    {detail.history.length === 0 && <p className="text-gray-500">履歴なし</p>}
                    {detail.history.map(h => (
                      <div key={h.id} className="p-2 rounded border border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">
                          {h.evaluation_date}
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
