'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  fetchGscDetail,
  registerEvaluation,
  updateEvaluation,
  runEvaluationNow,
} from '@/server/actions/gscDashboard.actions';
import type {
  GscDashboardDetailResponse,
  GscMetricsSummary,
  GscVisibleMetrics,
  GscChartDataPoint,
  GscEvaluationHistoryItem,
} from '../types';

interface UseGscDashboardOptions {
  initialSelectedId?: string | null;
  initialDetail?: GscDashboardDetailResponse | null;
}

interface UseGscDashboardReturn {
  // State
  selectedId: string | null;
  detail: GscDashboardDetailResponse | null;
  detailLoading: boolean;
  error: string | null;
  visibleMetrics: GscVisibleMetrics;
  selectedHistory: GscEvaluationHistoryItem | null;

  // Computed
  chartData: GscChartDataPoint[];
  metricsSummary: GscMetricsSummary | null;

  // Actions
  setSelectedId: (id: string | null) => void;
  setSelectedHistory: (history: GscEvaluationHistoryItem | null) => void;
  toggleMetric: (key: keyof GscVisibleMetrics) => void;
  handleRegisterEvaluation: (dateStr: string, cycleDays: number, evaluationHour: number) => Promise<void>;
  handleUpdateEvaluation: (dateStr: string, cycleDays: number, evaluationHour: number) => Promise<void>;
  handleRunEvaluation: () => Promise<{ processed: number; improved: number; advanced: number; skippedNoMetrics: number; skippedImportFailed: number }>;
  refreshDetail: (annotationId: string) => Promise<void>;
}

export function useGscDashboard({
  initialSelectedId = null,
  initialDetail = null,
}: UseGscDashboardOptions): UseGscDashboardReturn {
  const searchParams = useSearchParams();

  // State
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [detail, setDetail] = useState<GscDashboardDetailResponse | null>(initialDetail);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleMetrics, setVisibleMetrics] = useState<GscVisibleMetrics>({
    clicks: true,
    impressions: true,
    ctr: true,
    position: true,
  });
  const [selectedHistory, setSelectedHistory] = useState<GscEvaluationHistoryItem | null>(null);

  const selectedFromUrl = searchParams.get('annotationId');

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

  // チャートデータ変換
  const chartData = useMemo<GscChartDataPoint[]>(() => {
    if (!detail?.metrics) return [];
    return detail.metrics.map(m => ({
      date: m.date,
      position: m.position ?? null,
      ctr: m.ctr != null ? Math.round(m.ctr * 10000) / 100 : null, // to %
      clicks: m.clicks ?? null,
      impressions: m.impressions ?? null,
    }));
  }, [detail]);

  // メトリクスサマリー計算
  const metricsSummary = useMemo<GscMetricsSummary | null>(() => {
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

  // アクション: メトリクス表示トグル
  const toggleMetric = useCallback((key: keyof GscVisibleMetrics) => {
    setVisibleMetrics(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // アクション: 詳細再取得
  const refreshDetail = useCallback(async (annotationId: string) => {
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
  }, []);

  // アクション: 評価登録
  const handleRegisterEvaluation = useCallback(
    async (dateStr: string, cycleDays: number, evaluationHour: number) => {
      if (!selectedId || !detail?.credential?.propertyUri) return;

      const res = await registerEvaluation({
        contentAnnotationId: selectedId,
        propertyUri: detail.credential.propertyUri,
        baseEvaluationDate: dateStr,
        cycleDays,
        evaluationHour,
      });

      if (!res.success) {
        throw new Error(res.error || '評価対象の登録に失敗しました');
      }

      // データリロード
      await refreshDetail(selectedId);
    },
    [selectedId, detail?.credential?.propertyUri, refreshDetail]
  );

  // アクション: 評価更新
  const handleUpdateEvaluation = useCallback(
    async (dateStr: string, cycleDays: number, evaluationHour: number) => {
      if (!selectedId) return;

      const res = await updateEvaluation({
        contentAnnotationId: selectedId,
        baseEvaluationDate: dateStr,
        cycleDays,
        evaluationHour,
      });

      if (!res.success) {
        throw new Error(res.error || '評価日の更新に失敗しました');
      }

      // データリロード
      await refreshDetail(selectedId);
    },
    [selectedId, refreshDetail]
  );

  // アクション: 今すぐ評価を実行
  const handleRunEvaluation = useCallback(async () => {
    const res = await runEvaluationNow();

    if (!res.success) {
      throw new Error(res.error || '評価処理に失敗しました');
    }

    // データリロード
    if (selectedId) {
      await refreshDetail(selectedId);
    }

    return res.data!;
  }, [selectedId, refreshDetail]);

  return {
    // State
    selectedId,
    detail,
    detailLoading,
    error,
    visibleMetrics,
    selectedHistory,

    // Computed
    chartData,
    metricsSummary,

    // Actions
    setSelectedId,
    setSelectedHistory,
    toggleMetric,
    handleRegisterEvaluation,
    handleUpdateEvaluation,
    handleRunEvaluation,
    refreshDetail,
  };
}

