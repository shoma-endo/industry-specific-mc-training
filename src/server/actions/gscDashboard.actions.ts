'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';
import { gscImportService } from '@/server/services/gscImportService';
import { normalizeUrl } from '@/lib/normalize-url';
import type { GscEvaluationOutcome } from '@/types/gsc';

const supabaseService = new SupabaseService();

export type GscDetailResponse = {
  success: boolean;
  data?: {
    annotation: {
      id: string;
      wp_post_id: number | null;
      wp_post_title: string | null;
      canonical_url: string | null;
      opening_proposal: string | null;
      wp_content_text: string | null;
      wp_excerpt?: string | null;
      persona: string | null;
      needs: string | null;
    };
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
      current_position: number | null; // nullable for errors
      outcome: GscEvaluationOutcome | null; // nullable for errors
      outcomeType: 'success' | 'error';
      errorCode?: 'import_failed' | 'no_metrics' | null;
      errorMessage?: string | null;
      suggestion_summary: string | null;
      is_read: boolean;
      created_at: string;
    }>;
    evaluation: {
      id: string;
      user_id: string;
      content_annotation_id: string;
      property_uri: string;
      last_evaluated_on: string | null;
      base_evaluation_date: string;
      cycle_days: number;
      evaluation_hour: number;
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
      .select(
        'id, wp_post_id, wp_post_title, canonical_url, opening_proposal, wp_content_text, wp_excerpt, persona, needs'
      )
      .eq('user_id', userId)
      .eq('id', annotationId)
      .maybeSingle();

    if (annotationError) {
      throw new Error(annotationError.message);
    }
    if (!annotation) {
      return { success: false, error: '対象が見つかりません' };
    }

    const credential = await supabaseService.getGscCredentialByUserId(userId);

    let metricsQuery = supabaseService
      .getClient()
      .from('gsc_page_metrics')
      .select('date, position, ctr, clicks, impressions')
      .eq('user_id', userId)
      .eq('content_annotation_id', annotationId)
      .gte('date', startIso)
      .order('date', { ascending: true });

    if (credential?.propertyUri) {
      metricsQuery = metricsQuery.eq('property_uri', credential.propertyUri);
    }

    const { data: metrics, error: metricError } = await metricsQuery;

    if (metricError) {
      throw new Error(metricError.message);
    }

    const { data: history, error: historyError } = await supabaseService
      .getClient()
      .from('gsc_article_evaluation_history')
      .select('*')
      .eq('user_id', userId)
      .eq('content_annotation_id', annotationId)
      .order('created_at', { ascending: false })
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

    return {
      success: true,
      data: {
        annotation,
        metrics: metrics ?? [],
        history:
          history?.map(item => ({
            ...item,
            outcomeType: item.outcome_type,
            errorCode: item.error_code,
            errorMessage: item.error_message,
          })) ?? [],
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
  evaluation_hour?: number;
}): string {
  const cycle = evaluation.cycle_days || 30;
  const hour = evaluation.evaluation_hour ?? 12;
  const last = evaluation.last_evaluated_on;
  const baseDate = last ?? evaluation.base_evaluation_date;
  const base = new Date(`${baseDate}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + cycle);
  // JST時間をUTCに変換（JST = UTC + 9）
  const utcHour = (hour - 9 + 24) % 24;
  base.setUTCHours(utcHour, 0, 0, 0);
  return base.toISOString();
}

export async function registerEvaluation(params: {
  contentAnnotationId: string;
  propertyUri: string;
  baseEvaluationDate: string;
  cycleDays?: number;
  evaluationHour?: number;
}) {
  try {
    const { userId, error } = await getAuthUserId();
    if (error || !userId) {
      return { success: false, error: error || 'ユーザー認証に失敗しました' };
    }

    const { contentAnnotationId, propertyUri, baseEvaluationDate, cycleDays, evaluationHour } =
      params;
    if (!contentAnnotationId || !propertyUri || !baseEvaluationDate) {
      return {
        success: false,
        error: 'contentAnnotationId, propertyUri, baseEvaluationDate は必須です',
      };
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

    const validatedEvaluationHour = evaluationHour ?? 12;
    if (validatedEvaluationHour < 0 || validatedEvaluationHour > 23) {
      return { success: false, error: '評価実行時間は0〜23の範囲で指定してください' };
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
        evaluation_hour: validatedEvaluationHour,
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
  evaluationHour?: number;
}) {
  try {
    const { userId, error } = await getAuthUserId();
    if (error || !userId) {
      return { success: false, error: error || 'ユーザー認証に失敗しました' };
    }

    const { contentAnnotationId, baseEvaluationDate, cycleDays, evaluationHour } = params;
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

    if (evaluationHour !== undefined && (evaluationHour < 0 || evaluationHour > 23)) {
      return { success: false, error: '評価実行時間は0〜23の範囲で指定してください' };
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

    const updateData: {
      base_evaluation_date: string;
      cycle_days?: number;
      evaluation_hour?: number;
      updated_at: string;
    } = {
      base_evaluation_date: baseEvaluationDate,
      updated_at: new Date().toISOString(),
    };
    if (cycleDays !== undefined) {
      updateData.cycle_days = cycleDays;
    }
    if (evaluationHour !== undefined) {
      updateData.evaluation_hour = evaluationHour;
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

    // GSC Credential取得（PropertyURIが必要）
    const credential = await supabaseService.getGscCredentialByUserId(userId);
    if (!credential || !credential.propertyUri) {
      return { success: false, error: 'GSC連携設定が見つかりません' };
    }
    const propertyUri = credential.propertyUri;

    // annotationのnormalized_urlを取得（DBで自動生成された正規化済みURL）
    const { data: annotation, error: annotationError } = await supabaseService
      .getClient()
      .from('content_annotations')
      .select('normalized_url')
      .eq('id', annotationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (annotationError || !annotation?.normalized_url) {
      return { success: false, error: '記事が見つかりません' };
    }

    const normalizedUrl = annotation.normalized_url;

    // RPC呼び出しでDB側で集計（パフォーマンス最適化）
    const { data: rpcData, error: rpcError } = await supabaseService
      .getClient()
      .rpc('get_gsc_query_analysis', {
        p_user_id: userId,
        p_property_uri: propertyUri,
        p_normalized_url: normalizedUrl,
        p_start_date: startIso,
        p_end_date: endIso,
        p_comp_start_date: compStartIso,
        p_comp_end_date: compEndIso,
      });

    if (rpcError) {
      throw new Error(rpcError.message);
    }

    // RPC結果をQueryAggregation形式に変換
    const queries: QueryAggregation[] = (rpcData ?? []).map(
      (row: {
        query: string;
        query_normalized: string;
        clicks: number;
        impressions: number;
        avg_ctr: number;
        avg_position: number;
        position_change: number | null;
        clicks_change: number | null;
        word_count: number;
      }) => ({
        query: row.query,
        queryNormalized: row.query_normalized,
        clicks: Number(row.clicks),
        impressions: Number(row.impressions),
        ctr: Number(row.avg_ctr),
        position: Number(row.avg_position),
        positionChange: row.position_change !== null ? Number(row.position_change) : null,
        clicksChange: row.clicks_change !== null ? Number(row.clicks_change) : null,
        wordCount: row.word_count,
      })
    );

    // サマリー計算（軽量RPCを使うことも可能だが、ここではクエリ数なども必要なため集計結果から算出）
    // 大量データの場合は get_gsc_query_summary を別途呼ぶ設計もありうるが、
    // 現状はフィルタ後の件数表示などにqueriesが必要なためこのまま。
    const totalClicks = queries.reduce((sum, q) => sum + q.clicks, 0);
    const totalImpressions = queries.reduce((sum, q) => sum + q.impressions, 0);
    const positionNumerator = queries.reduce(
      (sum, q) => sum + q.position * q.impressions,
      0
    );
    const avgPosition = totalImpressions > 0 ? positionNumerator / totalImpressions : 0;

    return {
      success: true,
      data: {
        queries,
        summary: {
          totalQueries: queries.length,
          totalClicks,
          totalImpressions,
          avgPosition,
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

export async function runQueryImportForAnnotation(annotationId: string, options?: { days?: number }) {
  try {
    const { userId, error } = await getAuthUserId();
    if (error || !userId) {
      return { success: false, error: error || 'ユーザー認証に失敗しました' };
    }

    if (!annotationId) {
      return { success: false, error: 'annotationId は必須です' };
    }

    const { data: annotation, error: annotationError } = await supabaseService
      .getClient()
      .from('content_annotations')
      .select('id, canonical_url')
      .eq('id', annotationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (annotationError) {
      throw new Error(annotationError.message || '記事情報の取得に失敗しました');
    }
    if (!annotation?.canonical_url) {
      return { success: false, error: '記事のURLが見つかりません' };
    }

    const days = Math.min(180, Math.max(7, options?.days ?? 90));
    const endDate = new Date();
    endDate.setUTCDate(endDate.getUTCDate() - 2); // GSCは2日前まで
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - days + 1);

    const startIso = startDate.toISOString().slice(0, 10);
    const endIso = endDate.toISOString().slice(0, 10);

    // URL変更時の整合性を守るため、インポート前に古い指標データをクリーンアップ
    const currentNormalizedUrl = normalizeUrl(annotation.canonical_url);
    if (currentNormalizedUrl) {
      await supabaseService.cleanupOldGscQueryMetrics(annotationId, currentNormalizedUrl);
    }

    await gscImportService.importPageMetricsForUrl(userId, {
      startDate: startIso,
      endDate: endIso,
      pageUrl: annotation.canonical_url,
      contentAnnotationId: annotation.id,
    });

    const summary = await gscImportService.importQueryMetricsForUrl(userId, {
      startDate: startIso,
      endDate: endIso,
      pageUrl: annotation.canonical_url,
    });

    revalidatePath('/gsc-dashboard');
    return { success: true, data: summary };
  } catch (error) {
    console.error('[gsc-dashboard] run query import failed', error);
    const message = error instanceof Error ? error.message : 'クエリ指標の取得に失敗しました';
    return { success: false, error: message };
  }
}

/**
 * 今すぐ評価を実行（手動実行用）
 *
 * 評価期限に関係なく、ログインユーザーの全評価対象記事について：
 * 1. cycle_days 日分のデータをインポート
 * 2. 評価を実行（順位比較 + 改善提案生成）
 */
export async function runEvaluationNow(contentAnnotationId: string) {
  try {
    const { userId, error } = await getAuthUserId();
    if (error || !userId) {
      return { success: false, error: error || 'ユーザー認証に失敗しました' };
    }

    // 動的インポートで循環参照を回避
    const { gscEvaluationService } = await import('@/server/services/gscEvaluationService');

    // 手動実行なので force: true で評価期限をスキップ
    const summary = await gscEvaluationService.runDueEvaluationsForUser(userId, {
      force: true,
      contentAnnotationId,
    });

    revalidatePath('/gsc-dashboard');
    revalidatePath('/analytics');

    return {
      success: true,
      data: {
        processed: summary.processed,
        improved: summary.improved,
        advanced: summary.advanced,
        skippedNoMetrics: summary.skippedNoMetrics,
        skippedImportFailed: summary.skippedImportFailed,
      },
    };
  } catch (error) {
    console.error('[gsc-dashboard] run evaluation now failed', error);
    const message = error instanceof Error ? error.message : '評価処理に失敗しました';
    return { success: false, error: message };
  }
}
