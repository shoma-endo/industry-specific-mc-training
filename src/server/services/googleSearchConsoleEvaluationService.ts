import { SupabaseService } from '@/server/services/supabaseService';
import { getGscEvaluationConfig } from '@/server/lib/googleSearchConsoleConfig';
import type { GscEvaluationOutcome, GscPageMetric } from '@/types/googleSearchConsole';

interface EvaluationResultSummary {
  processed: number;
  improved: number;
  advanced: number;
  skippedNoMetrics: number;
}

type EvaluationRow = {
  id: string;
  user_id: string;
  content_annotation_id: string;
  property_uri: string;
  last_evaluated_on?: string | null;
  base_evaluation_date: string;
  last_seen_position?: number | null;
  status: string;
};

export class GoogleSearchConsoleEvaluationService {
  private readonly supabaseService = new SupabaseService();

  async runDueEvaluationsForUser(userId: string): Promise<EvaluationResultSummary> {
    const today = this.todayISO();
    const { intervalDays } = getGscEvaluationConfig();

    const summary: EvaluationResultSummary = {
      processed: 0,
      improved: 0,
      advanced: 0,
      skippedNoMetrics: 0,
    };

    // 全てのアクティブな評価対象を取得
    const { data: evaluations, error: evalError } = await this.supabaseService
      .getClient()
      .from('gsc_article_evaluations')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (evalError) {
      throw new Error(evalError.message || '評価対象の取得に失敗しました');
    }

    const allEvaluations = (evaluations ?? []) as EvaluationRow[];

    // 評価期限が来ているものをフィルタリング
    // 初回（last_evaluated_on が null）: base_evaluation_date + 30日 <= today
    // 2回目以降: last_evaluated_on + 30日 <= today
    const evaluationRows = allEvaluations.filter((evaluation) => {
      if (!evaluation.last_evaluated_on) {
        // 初回評価: base_evaluation_date + intervalDays <= today
        const firstEvaluationDate = this.addDaysISO(evaluation.base_evaluation_date, intervalDays);
        return firstEvaluationDate <= today;
      } else {
        // 2回目以降: last_evaluated_on + intervalDays <= today
        const nextEvaluationDate = this.addDaysISO(evaluation.last_evaluated_on, intervalDays);
        return nextEvaluationDate <= today;
      }
    });

    for (const evaluation of evaluationRows) {
      const metric = await this.fetchLatestMetric(userId, evaluation);

      if (!metric) {
        summary.skippedNoMetrics += 1;
        continue;
      }

      const lastSeen = this.toNumberOrNull(evaluation.last_seen_position);
      const currentPos = this.toNumberOrNull(metric.position);

      if (currentPos === null) {
        summary.skippedNoMetrics += 1;
        continue;
      }

      const outcome = this.judgeOutcome(lastSeen, currentPos);

      // 更新: evaluations
      // base_evaluation_date は更新しない（固定された評価基準日として保持）
      const { error: updateError } = await this.supabaseService
        .getClient()
        .from('gsc_article_evaluations')
        .update({
          last_seen_position: currentPos,
          last_evaluated_on: today,
          updated_at: new Date().toISOString(),
        })
        .eq('id', evaluation.id)
        .eq('user_id', userId);

      if (updateError) {
        throw new Error(updateError.message || '評価レコード更新に失敗しました');
      }

      // 挿入: history
      const { error: historyError } = await this.supabaseService
        .getClient()
        .from('gsc_article_evaluation_history')
        .insert({
          user_id: userId,
          content_annotation_id: evaluation.content_annotation_id,
          evaluation_date: today,
          previous_position: lastSeen,
          current_position: currentPos,
          outcome,
          suggestion_applied: false,
          created_at: new Date().toISOString(),
        });

      if (historyError) {
        throw new Error(historyError.message || '評価履歴の保存に失敗しました');
      }

      summary.processed += 1;
      if (outcome === 'improved') {
        summary.improved += 1;
      } else {
        summary.advanced += 1; // 停滞/悪化はステージを進めた扱い
      }
    }

    return summary;
  }

  /** 最新の日次メトリクスを取得（content_annotation_id で直接紐付け） */
  private async fetchLatestMetric(
    userId: string,
    evaluation: EvaluationRow
  ): Promise<Pick<GscPageMetric, 'position' | 'date'> | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('gsc_page_metrics')
      .select('position, date')
      .eq('user_id', userId)
      .eq('property_uri', evaluation.property_uri)
      .eq('content_annotation_id', evaluation.content_annotation_id)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || 'メトリクスの取得に失敗しました');
    }

    if (!data) return null;
    return data as Pick<GscPageMetric, 'position' | 'date'>;
  }

  private judgeOutcome(
    lastSeen: number | null,
    currentPos: number
  ): GscEvaluationOutcome {
    if (lastSeen === null) return 'no_change';
    if (currentPos < lastSeen) return 'improved';
    if (currentPos > lastSeen) return 'worse';
    return 'no_change';
  }

  private todayISO(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private addDaysISO(baseISO: string, days: number): string {
    const base = new Date(`${baseISO}T00:00:00.000Z`);
    base.setUTCDate(base.getUTCDate() + days);
    return base.toISOString().slice(0, 10);
  }

  private toNumberOrNull(value: unknown): number | null {
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) ? num : null;
  }
}

export const googleSearchConsoleEvaluationService = new GoogleSearchConsoleEvaluationService();
