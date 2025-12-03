'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';
import type { GscEvaluationOutcome } from '@/types/gsc';

const supabaseService = new SupabaseService();

export type GscDetailResponse = {
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
    next_evaluation_run_utc?: string | null;
    credential: {
      propertyUri: string | null;
    } | null;
  };
  error?: string;
};

const getAuthUserId = async () => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('line_access_token')?.value;
  const refreshToken = cookieStore.get('line_refresh_token')?.value;

  const authResult = await authMiddleware(accessToken, refreshToken);
  if (authResult.error || !authResult.userId) {
    return { error: authResult.error || 'ユーザー認証に失敗しました' };
  }
  return { userId: authResult.userId };
};

export async function fetchGscDetail(
  annotationId: string,
  options?: { days?: number }
): Promise<GscDetailResponse> {
  try {
    const { userId, error } = await getAuthUserId();
    if (error || !userId) {
      return { success: false, error: error || 'ユーザー認証に失敗しました' };
    }

    const days = Math.min(180, Math.max(7, options?.days ?? 90));
    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - days);
    const startIso = startDate.toISOString().slice(0, 10);

    const { data: annotation, error: annotationError } = await supabaseService
      .getClient()
      .from('content_annotations')
      .select('id, wp_post_title, canonical_url')
      .eq('user_id', userId)
      .eq('id', annotationId)
      .maybeSingle();

    if (annotationError) {
      throw new Error(annotationError.message);
    }
    if (!annotation) {
      return { success: false, error: '対象が見つかりません' };
    }

    const { data: metrics, error: metricError } = await supabaseService
      .getClient()
      .from('gsc_page_metrics')
      .select('date, position, ctr, clicks, impressions')
      .eq('user_id', userId)
      .eq('content_annotation_id', annotationId)
      .gte('date', startIso)
      .order('date', { ascending: true });

    if (metricError) {
      throw new Error(metricError.message);
    }

    const { data: history, error: historyError } = await supabaseService
      .getClient()
      .from('gsc_article_evaluation_history')
      .select('*')
      .eq('user_id', userId)
      .eq('content_annotation_id', annotationId)
      .order('evaluation_date', { ascending: false })
      .limit(100);

    if (historyError) {
      throw new Error(historyError.message);
    }

    const { data: evaluation, error: evaluationError } = await supabaseService
      .getClient()
      .from('gsc_article_evaluations')
      .select('*')
      .eq('user_id', userId)
      .eq('content_annotation_id', annotationId)
      .maybeSingle();

    if (evaluationError) {
      throw new Error(evaluationError.message);
    }

    const credential = await supabaseService.getGscCredentialByUserId(userId);

    return {
      success: true,
      data: {
        annotation,
        metrics: metrics ?? [],
        history: history ?? [],
        evaluation: evaluation ?? null,
        next_evaluation_run_utc: evaluation ? computeNextRunAtJst(evaluation) : null,
        credential: credential ? { propertyUri: credential.propertyUri ?? null } : null,
      },
    };
  } catch (error) {
    console.error('[gsc-dashboard] fetch detail failed', error);
    const message = error instanceof Error ? error.message : '詳細の取得に失敗しました';
    return { success: false, error: message };
  }
}

function computeNextRunAtJst(evaluation: {
  last_evaluated_on: string | null;
  base_evaluation_date: string;
  cycle_days: number;
}): string {
  const cycle = evaluation.cycle_days || 30;
  const last = evaluation.last_evaluated_on;
  const baseDate = last ?? evaluation.base_evaluation_date;
  const base = new Date(`${baseDate}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + cycle);
  // JST 12:00 は UTC 03:00
  base.setUTCHours(3, 0, 0, 0);
  return base.toISOString();
}

export async function registerEvaluation(params: {
  contentAnnotationId: string;
  propertyUri: string;
  baseEvaluationDate: string;
  cycleDays?: number;
}) {
  try {
    const { userId, error } = await getAuthUserId();
    if (error || !userId) {
      return { success: false, error: error || 'ユーザー認証に失敗しました' };
    }

    const { contentAnnotationId, propertyUri, baseEvaluationDate, cycleDays } = params;
    if (!contentAnnotationId || !propertyUri || !baseEvaluationDate) {
      return { success: false, error: 'contentAnnotationId, propertyUri, baseEvaluationDate は必須です' };
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(baseEvaluationDate)) {
      return { success: false, error: '日付は YYYY-MM-DD 形式で指定してください' };
    }
    const evaluationDate = new Date(`${baseEvaluationDate}T00:00:00.000Z`);
    if (Number.isNaN(evaluationDate.getTime())) {
      return { success: false, error: '無効な日付が指定されました' };
    }

    const validatedCycleDays = cycleDays ?? 30;
    if (validatedCycleDays < 1 || validatedCycleDays > 365) {
      return { success: false, error: '評価サイクル日数は1〜365日の範囲で指定してください' };
    }

    const { data: annotation, error: annotationError } = await supabaseService
      .getClient()
      .from('content_annotations')
      .select('id')
      .eq('id', contentAnnotationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (annotationError) {
      throw new Error(annotationError.message || 'アノテーションの確認に失敗しました');
    }
    if (!annotation) {
      return { success: false, error: '指定された記事が見つかりません' };
    }

    const { data: existing, error: duplicateError } = await supabaseService
      .getClient()
      .from('gsc_article_evaluations')
      .select('id')
      .eq('user_id', userId)
      .eq('content_annotation_id', contentAnnotationId)
      .maybeSingle();

    if (duplicateError) {
      throw new Error(duplicateError.message || '重複チェックに失敗しました');
    }
    if (existing) {
      return { success: false, error: 'この記事は既に評価対象として登録されています' };
    }

    const { error: insertError } = await supabaseService
      .getClient()
      .from('gsc_article_evaluations')
      .insert({
        user_id: userId,
        content_annotation_id: contentAnnotationId,
        property_uri: propertyUri,
        base_evaluation_date: baseEvaluationDate,
        cycle_days: validatedCycleDays,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      throw new Error(insertError.message || '評価対象の登録に失敗しました');
    }

    revalidatePath('/gsc-dashboard');
    return { success: true, data: { contentAnnotationId, baseEvaluationDate } };
  } catch (error) {
    console.error('[gsc-dashboard] register evaluation failed', error);
    const message = error instanceof Error ? error.message : '評価対象の登録に失敗しました';
    return { success: false, error: message };
  }
}

export async function updateEvaluation(params: {
  contentAnnotationId: string;
  baseEvaluationDate: string;
  cycleDays?: number;
}) {
  try {
    const { userId, error } = await getAuthUserId();
    if (error || !userId) {
      return { success: false, error: error || 'ユーザー認証に失敗しました' };
    }

    const { contentAnnotationId, baseEvaluationDate, cycleDays } = params;
    if (!contentAnnotationId || !baseEvaluationDate) {
      return { success: false, error: 'contentAnnotationId, baseEvaluationDate は必須です' };
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(baseEvaluationDate)) {
      return { success: false, error: '日付は YYYY-MM-DD 形式で指定してください' };
    }
    const evaluationDate = new Date(`${baseEvaluationDate}T00:00:00.000Z`);
    if (Number.isNaN(evaluationDate.getTime())) {
      return { success: false, error: '無効な日付が指定されました' };
    }

    if (cycleDays !== undefined && (cycleDays < 1 || cycleDays > 365)) {
      return { success: false, error: '評価サイクル日数は1〜365日の範囲で指定してください' };
    }

    const { data: evaluation, error: evaluationError } = await supabaseService
      .getClient()
      .from('gsc_article_evaluations')
      .select('id')
      .eq('user_id', userId)
      .eq('content_annotation_id', contentAnnotationId)
      .maybeSingle();

    if (evaluationError) {
      throw new Error(evaluationError.message || '評価対象の確認に失敗しました');
    }

    if (!evaluation) {
      return { success: false, error: '評価対象が見つかりません' };
    }

    const updateData: { base_evaluation_date: string; cycle_days?: number; updated_at: string } = {
      base_evaluation_date: baseEvaluationDate,
      updated_at: new Date().toISOString(),
    };
    if (cycleDays !== undefined) {
      updateData.cycle_days = cycleDays;
    }

    const { error: updateError } = await supabaseService
      .getClient()
      .from('gsc_article_evaluations')
      .update(updateData)
      .eq('id', evaluation.id)
      .eq('user_id', userId);

    if (updateError) {
      throw new Error(updateError.message || '評価基準日の更新に失敗しました');
    }

    revalidatePath('/gsc-dashboard');
    return { success: true, data: { contentAnnotationId, baseEvaluationDate } };
  } catch (error) {
    console.error('[gsc-dashboard] update evaluation failed', error);
    const message = error instanceof Error ? error.message : '評価日の更新に失敗しました';
    return { success: false, error: message };
  }
}

// ============================================
// Query Analysis 用の型定義と関数
// ============================================

export interface QueryAggregation {
  query: string;
  queryNormalized: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  positionChange: number | null;
  clicksChange: number | null;
  wordCount: number;
}

export interface QueryAnalysisResponse {
  success: boolean;
  data?: {
    queries: QueryAggregation[];
    summary: {
      totalQueries: number;
      totalClicks: number;
      totalImpressions: number;
      avgPosition: number;
    };
    period: {
      start: string;
      end: string;
      comparisonStart: string;
      comparisonEnd: string;
    };
  };
  error?: string;
}

/**
 * クエリ別集計データを取得
 * @param annotationId - content_annotation_id
 * @param dateRange - '7d' | '28d' | '3m'
 */
export async function fetchQueryAnalysis(
  annotationId: string,
  dateRange: '7d' | '28d' | '3m' = '28d'
): Promise<QueryAnalysisResponse> {
  try {
    const { userId, error } = await getAuthUserId();
    if (error || !userId) {
      return { success: false, error: error || 'ユーザー認証に失敗しました' };
    }

    // 期間計算
    const now = new Date();
    const days = dateRange === '7d' ? 7 : dateRange === '28d' ? 28 : 90;

    const endDate = new Date(now);
    endDate.setUTCDate(endDate.getUTCDate() - 2); // GSCは2日前まで
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - days + 1);

    // 比較期間
    const compEndDate = new Date(startDate);
    compEndDate.setUTCDate(compEndDate.getUTCDate() - 1);
    const compStartDate = new Date(compEndDate);
    compStartDate.setUTCDate(compStartDate.getUTCDate() - days + 1);

    const startIso = startDate.toISOString().slice(0, 10);
    const endIso = endDate.toISOString().slice(0, 10);
    const compStartIso = compStartDate.toISOString().slice(0, 10);
    const compEndIso = compEndDate.toISOString().slice(0, 10);

    // annotationのcanonical_urlを取得
    const { data: annotation, error: annotationError } = await supabaseService
      .getClient()
      .from('content_annotations')
      .select('canonical_url')
      .eq('id', annotationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (annotationError || !annotation?.canonical_url) {
      return { success: false, error: '記事が見つかりません' };
    }

    // URLを正規化（DB規約 public.normalize_url に準拠）
    // プロトコル除去、www.除去、末尾スラッシュ除去、小文字化
    const normalizedUrl = annotation.canonical_url
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/+$/g, '');

    // 現在期間のクエリデータを取得
    const { data: currentMetrics, error: currentError } = await supabaseService
      .getClient()
      .from('gsc_query_metrics')
      .select('query, query_normalized, clicks, impressions, ctr, position')
      .eq('user_id', userId)
      .eq('normalized_url', normalizedUrl)
      .gte('date', startIso)
      .lte('date', endIso);

    if (currentError) {
      throw new Error(currentError.message);
    }

    // 比較期間のクエリデータを取得
    const { data: previousMetrics, error: previousError } = await supabaseService
      .getClient()
      .from('gsc_query_metrics')
      .select('query_normalized, clicks, position')
      .eq('user_id', userId)
      .eq('normalized_url', normalizedUrl)
      .gte('date', compStartIso)
      .lte('date', compEndIso);

    if (previousError) {
      throw new Error(previousError.message);
    }

    // クエリ別に集計（現在期間）
    const queryMap = new Map<
      string,
      {
        query: string;
        queryNormalized: string;
        clicks: number;
        impressions: number;
        ctrSum: number;
        positionSum: number;
        count: number;
      }
    >();

    for (const row of currentMetrics ?? []) {
      const key = row.query_normalized;
      const existing = queryMap.get(key);
      if (existing) {
        existing.clicks += row.clicks;
        existing.impressions += row.impressions;
        existing.ctrSum += row.ctr;
        existing.positionSum += row.position;
        existing.count += 1;
      } else {
        queryMap.set(key, {
          query: row.query,
          queryNormalized: row.query_normalized,
          clicks: row.clicks,
          impressions: row.impressions,
          ctrSum: row.ctr,
          positionSum: row.position,
          count: 1,
        });
      }
    }

    // 比較期間の集計
    const prevMap = new Map<string, { clicks: number; positionSum: number; count: number }>();
    for (const row of previousMetrics ?? []) {
      const key = row.query_normalized;
      const existing = prevMap.get(key);
      if (existing) {
        existing.clicks += row.clicks;
        existing.positionSum += row.position;
        existing.count += 1;
      } else {
        prevMap.set(key, {
          clicks: row.clicks,
          positionSum: row.position,
          count: 1,
        });
      }
    }

    // 結果を配列に変換
    const queries: QueryAggregation[] = [];
    let totalClicks = 0;
    let totalImpressions = 0;
    let positionSumAll = 0;
    let positionCountAll = 0;

    for (const [key, value] of queryMap) {
      const avgPosition = value.positionSum / value.count;
      const avgCtr = value.ctrSum / value.count;
      const prev = prevMap.get(key);

      let positionChange: number | null = null;
      let clicksChange: number | null = null;

      if (prev) {
        const prevAvgPosition = prev.positionSum / prev.count;
        positionChange = avgPosition - prevAvgPosition; // 正: 悪化, 負: 改善
        clicksChange = value.clicks - prev.clicks;
      }

      // 単語数をカウント（スペース区切り）
      const wordCount = value.query.trim().split(/\s+/).length;

      queries.push({
        query: value.query,
        queryNormalized: value.queryNormalized,
        clicks: value.clicks,
        impressions: value.impressions,
        ctr: avgCtr,
        position: avgPosition,
        positionChange,
        clicksChange,
        wordCount,
      });

      totalClicks += value.clicks;
      totalImpressions += value.impressions;
      positionSumAll += avgPosition;
      positionCountAll += 1;
    }

    // クリック数降順でソート
    queries.sort((a, b) => b.clicks - a.clicks);

    return {
      success: true,
      data: {
        queries,
        summary: {
          totalQueries: queries.length,
          totalClicks,
          totalImpressions,
          avgPosition: positionCountAll > 0 ? positionSumAll / positionCountAll : 0,
        },
        period: {
          start: startIso,
          end: endIso,
          comparisonStart: compStartIso,
          comparisonEnd: compEndIso,
        },
      },
    };
  } catch (error) {
    console.error('[gsc-dashboard] fetch query analysis failed', error);
    const message = error instanceof Error ? error.message : 'クエリ分析の取得に失敗しました';
    return { success: false, error: message };
  }
}
