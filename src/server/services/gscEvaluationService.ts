import { SupabaseService } from '@/server/services/supabaseService';
import type { GscEvaluationOutcome, GscPageMetric } from '@/types/gsc';
import { gscSuggestionService } from '@/server/services/gscSuggestionService';
import { gscImportService } from '@/server/services/gscImportService';

interface EvaluationResultSummary {
  processed: number;
  improved: number;
  advanced: number;
  skippedNoMetrics: number;
  skippedImportFailed: number;
}

interface BatchResultSummary {
  usersProcessed: number;
  totalEvaluations: number;
  totalImproved: number;
  totalAdvanced: number;
  totalSkipped: number;
  errors: string[];
}

type EvaluationRow = {
  id: string;
  user_id: string;
  content_annotation_id: string;
  property_uri: string;
  current_suggestion_stage?: number | null;
  last_evaluated_on?: string | null;
  base_evaluation_date: string;
  cycle_days: number;
  evaluation_hour: number;
  last_seen_position?: number | null;
  status: string;
};

interface RunEvaluationOptions {
  /** true の場合、評価期限チェックをスキップして全評価対象を処理（手動実行用） */
  force?: boolean;
  /** 特定の記事のみ手動評価する場合に指定 */
  contentAnnotationId?: string;
}

export class GscEvaluationService {
  private readonly supabaseService = new SupabaseService();

  async runDueEvaluationsForUser(
    userId: string,
    options: RunEvaluationOptions = {}
  ): Promise<EvaluationResultSummary> {
    const { force = false, contentAnnotationId } = options as RunEvaluationOptions & {
      contentAnnotationId?: string;
    };
    const today = this.todayISO();

    const summary: EvaluationResultSummary = {
      processed: 0,
      improved: 0,
      advanced: 0,
      skippedNoMetrics: 0,
      skippedImportFailed: 0,
    };

    // 全てのアクティブな評価対象を取得
    const { data: evaluations, error: evalError } = await this.supabaseService
      .getClient()
      .from('gsc_article_evaluations')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .match(contentAnnotationId ? { content_annotation_id: contentAnnotationId } : {});

    if (evalError) {
      throw new Error(evalError.message || '評価対象の取得に失敗しました');
    }

    const allEvaluations = (evaluations ?? []) as EvaluationRow[];

    // force: true の場合はフィルタリングをスキップ（手動実行用）
    // それ以外は評価期限が来ているものをフィルタリング
    const evaluationRows = force
      ? allEvaluations
      : allEvaluations.filter((evaluation) => {
          const cycleDays = evaluation.cycle_days || 30;
      if (!evaluation.last_evaluated_on) {
        // 初回評価: base_evaluation_date + cycleDays <= today
        const firstEvaluationDate = this.addDaysISO(evaluation.base_evaluation_date, cycleDays);
        return firstEvaluationDate <= today;
      } else {
        // 2回目以降: last_evaluated_on + cycleDays <= today
        const nextEvaluationDate = this.addDaysISO(evaluation.last_evaluated_on, cycleDays);
        return nextEvaluationDate <= today;
      }
    });

    // 全ての評価を並列実行
    const results = await Promise.allSettled(
      evaluationRows.map((evaluation) => this.processEvaluation(userId, evaluation, today))
    );

    // 結果を集約
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const evalResult = result.value;
        if (evalResult.status === 'skipped_import_failed') {
          summary.skippedImportFailed += 1;
        } else if (evalResult.status === 'skipped_no_metrics') {
          summary.skippedNoMetrics += 1;
        } else if (evalResult.status === 'success') {
          summary.processed += 1;
          if (evalResult.outcome === 'improved') {
            summary.improved += 1;
          } else {
            summary.advanced += 1;
          }
        }
      } else {
        // Promise が reject された場合（想定外のエラー）
        console.error('[gscEvaluationService] Evaluation failed:', result.reason);
        summary.skippedImportFailed += 1;
      }
    }

    return summary;
  }

  /**
   * 単一の評価を処理（並列実行用）
   */
  private async processEvaluation(
    userId: string,
    evaluation: EvaluationRow,
    today: string
  ): Promise<
    | { status: 'success'; outcome: GscEvaluationOutcome }
    | { status: 'skipped_import_failed' }
    | { status: 'skipped_no_metrics' }
  > {
    // cycle_days 日分のデータをインポート
    const cycleDays = evaluation.cycle_days || 30;
    const startDate = this.addDaysISO(today, -cycleDays);

    try {
      await gscImportService.importMetrics(userId, {
        startDate,
        endDate: today,
        searchType: 'web',
        maxRows: 5000,
      });
      console.log(
        `[gscEvaluationService] Imported ${cycleDays} days of data for evaluation ${evaluation.id}`
      );
    } catch (importError) {
      console.error(
        `[gscEvaluationService] Failed to import data for evaluation ${evaluation.id}:`,
        importError
      );

      // 履歴にエラーを記録
      const { error: historyInsertError } = await this.supabaseService.getClient()
        .from('gsc_article_evaluation_history')
        .insert({
          user_id: userId,
          content_annotation_id: evaluation.content_annotation_id,
          evaluation_date: today,
          outcome_type: 'error',
          error_code: 'import_failed',
          error_message: importError instanceof Error
            ? importError.message
            : 'Google Search Consoleからのデータ取得に失敗しました',
          suggestion_applied: false,
          created_at: new Date().toISOString(),
        });

      if (historyInsertError) {
        console.error(
          `[gscEvaluationService] Failed to save error history for evaluation ${evaluation.id}:`,
          historyInsertError
        );
      }

      return { status: 'skipped_import_failed' };
    }

    const metric = await this.fetchLatestMetric(userId, evaluation);

    if (!metric) {
      // 履歴にエラーを記録
      const { error: historyInsertError } = await this.supabaseService.getClient()
        .from('gsc_article_evaluation_history')
        .insert({
          user_id: userId,
          content_annotation_id: evaluation.content_annotation_id,
          evaluation_date: today,
          outcome_type: 'error',
          error_code: 'no_metrics',
          error_message: 'この記事のメトリクスデータが見つかりませんでした。Google Search Consoleに記事が表示されているか確認してください。',
          suggestion_applied: false,
          created_at: new Date().toISOString(),
        });

      if (historyInsertError) {
        console.error(
          `[gscEvaluationService] Failed to save error history for evaluation ${evaluation.id}:`,
          historyInsertError
        );
      }

      return { status: 'skipped_no_metrics' };
    }

    const lastSeen = this.toNumberOrNull(evaluation.last_seen_position);
    const currentPos = this.toNumberOrNull(metric.position);

    if (currentPos === null) {
      // 履歴にエラーを記録
      const { error: historyInsertError } = await this.supabaseService.getClient()
        .from('gsc_article_evaluation_history')
        .insert({
          user_id: userId,
          content_annotation_id: evaluation.content_annotation_id,
          evaluation_date: today,
          outcome_type: 'error',
          error_code: 'no_metrics',
          error_message: '検索順位データ（position）が取得できませんでした。',
          suggestion_applied: false,
          created_at: new Date().toISOString(),
        });

      if (historyInsertError) {
        console.error(
          `[gscEvaluationService] Failed to save error history for evaluation ${evaluation.id}:`,
          historyInsertError
        );
      }

      return { status: 'skipped_no_metrics' };
    }

    const outcome = this.judgeOutcome(lastSeen, currentPos);

    // 現在のステージを保存（提案生成に使用）
    const currentStage = evaluation.current_suggestion_stage || 1;

    // 次回のステージを計算
    let nextStage: number;
    if (outcome === 'improved') {
      // 改善された → ステージをリセット
      nextStage = 1;
    } else {
      // 改善されなかった（no_change or worse）→ ステージを進める（最大4で固定）
      nextStage = Math.min(currentStage + 1, 4);
    }

    // 更新: evaluations
    // base_evaluation_date は更新しない（固定された評価基準日として保持）
    const { error: updateError } = await this.supabaseService
      .getClient()
      .from('gsc_article_evaluations')
      .update({
        last_seen_position: currentPos,
        last_evaluated_on: today,
        current_suggestion_stage: nextStage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', evaluation.id)
      .eq('user_id', userId);

    if (updateError) {
      throw new Error(updateError.message || '評価レコード更新に失敗しました');
    }

    // 挿入: history
    const { data: historyRow, error: historyError } = await this.supabaseService
      .getClient()
      .from('gsc_article_evaluation_history')
      .insert({
        user_id: userId,
        content_annotation_id: evaluation.content_annotation_id,
        evaluation_date: metric.date ?? today,
        previous_position: lastSeen,
        current_position: currentPos,
        outcome,
        outcome_type: 'success',
        suggestion_applied: false,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();

    if (historyError) {
      throw new Error(historyError.message || '評価履歴の保存に失敗しました');
    }

    // 改善提案: 改善していない場合のみ実行（Claude API 呼び出し）
    // 現在のステージで提案を生成（次回のステージではない）
    if (outcome !== 'improved' && historyRow?.id) {
      await gscSuggestionService.generate({
        userId,
        contentAnnotationId: evaluation.content_annotation_id,
        evaluationId: evaluation.id,
        evaluationHistoryId: historyRow.id,
        outcome,
        currentPosition: currentPos,
        previousPosition: lastSeen,
        currentSuggestionStage: currentStage, // 現在のステージを渡す
      });
    }

    return { status: 'success', outcome };
  }

  /** 最新の日次メトリクスを取得（content_annotation_id で直接紐付け） */
  private async fetchLatestMetric(
    userId: string,
    evaluation: EvaluationRow
  ): Promise<Pick<GscPageMetric, 'position' | 'date'> | null> {
    // 評価日は固定せず「最新取得済みの指標」を採用する。
    // 直近日が欠損/nullでも、最終取得日で判定できるよう null position は除外。
    const { data, error } = await this.supabaseService
      .getClient()
      .from('gsc_page_metrics')
      .select('position, date')
      .eq('user_id', userId)
      .eq('property_uri', evaluation.property_uri)
      .eq('content_annotation_id', evaluation.content_annotation_id)
      .not('position', 'is', null)
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

  /**
   * 次回評価予定日時に達した全ユーザーの評価を実行（Cron バッチ用）
   *
   * 条件: (last_evaluated_on ?? base_evaluation_date) + cycle_days の日付
   *       + evaluation_hour の時間 <= 現在日時(JST)
   */
  async runAllDueEvaluations(): Promise<BatchResultSummary> {
    const summary: BatchResultSummary = {
      usersProcessed: 0,
      totalEvaluations: 0,
      totalImproved: 0,
      totalAdvanced: 0,
      totalSkipped: 0,
      errors: [],
    };

    // 現在の日本時間を取得
    const nowJst = this.getNowJst();
    const todayJst = this.formatDateISO(nowJst);
    const currentHourJst = nowJst.getHours();

    console.log(`[gscEvaluationService] Running batch at JST: ${todayJst} ${currentHourJst}:00`);

    // 全てのアクティブな評価対象を取得
    const { data: allEvaluations, error: evalError } = await this.supabaseService
      .getClient()
      .from('gsc_article_evaluations')
      .select('*')
      .eq('status', 'active');

    if (evalError) {
      throw new Error(evalError.message || '評価対象の取得に失敗しました');
    }

    const evaluations = (allEvaluations ?? []) as EvaluationRow[];

    // 次回評価予定日時に達しているものをフィルタリング
    const dueEvaluations = evaluations.filter(evaluation => {
      return this.isDue(evaluation, todayJst, currentHourJst);
    });

    console.log(`[gscEvaluationService] Found ${dueEvaluations.length} due evaluations out of ${evaluations.length} total`);

    // ユーザーIDでグルーピング
    const evaluationsByUser = new Map<string, EvaluationRow[]>();
    for (const evaluation of dueEvaluations) {
      const existing = evaluationsByUser.get(evaluation.user_id) ?? [];
      existing.push(evaluation);
      evaluationsByUser.set(evaluation.user_id, existing);
    }

    // 各ユーザーの評価を実行
    for (const [userId, userEvaluations] of evaluationsByUser) {
      try {
        console.log(`[gscEvaluationService] Processing user ${userId} with ${userEvaluations.length} evaluations`);

        const result = await this.runDueEvaluationsForUser(userId);

        summary.usersProcessed += 1;
        summary.totalEvaluations += result.processed;
        summary.totalImproved += result.improved;
        summary.totalAdvanced += result.advanced;
        summary.totalSkipped += result.skippedNoMetrics;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[gscEvaluationService] Error processing user ${userId}:`, message);
        summary.errors.push(`User ${userId}: ${message}`);
      }
    }

    return summary;
  }

  /**
   * 評価が予定日時に達しているかどうかを判定
   */
  private isDue(evaluation: EvaluationRow, todayJst: string, currentHourJst: number): boolean {
    const cycleDays = evaluation.cycle_days || 30;
    const evaluationHour = evaluation.evaluation_hour ?? 12;
    const baseDate = evaluation.last_evaluated_on ?? evaluation.base_evaluation_date;
    const nextEvaluationDate = this.addDaysISO(baseDate, cycleDays);

    // 日付が未到達の場合はスキップ
    if (nextEvaluationDate > todayJst) {
      return false;
    }

    // 日付が過去の場合は実行対象
    if (nextEvaluationDate < todayJst) {
      return true;
    }

    // 日付が今日の場合は時間をチェック
    // nextEvaluationDate === todayJst
    return currentHourJst >= evaluationHour;
  }

  /**
   * 現在の日本時間を取得
   */
  private getNowJst(): Date {
    const now = new Date();
    // UTC を JST (UTC+9) に変換
    const jstOffset = 9 * 60 * 60 * 1000;
    return new Date(now.getTime() + jstOffset);
  }

  /**
   * Date を YYYY-MM-DD 形式にフォーマット
   */
  private formatDateISO(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}

export const gscEvaluationService = new GscEvaluationService();
