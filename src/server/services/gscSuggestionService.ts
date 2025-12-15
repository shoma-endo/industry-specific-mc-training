import { SupabaseService } from '@/server/services/supabaseService';
import { PromptService } from '@/server/services/promptService';
import { llmChat } from '@/server/services/llmService';
import { MODEL_CONFIGS } from '@/lib/constants';
import type { GscEvaluationOutcome } from '@/types/gsc';
import { stripHtml } from '@/lib/utils';
import {
  buildWordPressServiceFromSettings,
  WPCOM_TOKEN_COOKIE_NAME,
} from '@/server/services/wordpressContext';

type SuggestionTemplate =
  | 'gsc_insight_ctr_boost'
  | 'gsc_insight_intro_refresh'
  | 'gsc_insight_body_rewrite'
  | 'gsc_insight_persona_rebuild';

interface GenerateParams {
  userId: string;
  contentAnnotationId: string;
  evaluationId: string;
  evaluationHistoryId: string;
  outcome: GscEvaluationOutcome;
  currentPosition: number | null;
  previousPosition: number | null;
  currentSuggestionStage: number; // 1-4
}

export class GscSuggestionService {
  private supabase = new SupabaseService();

  async generate(params: GenerateParams): Promise<void> {
    // outcome improved の場合は呼ばれない想定
    const annotation = await this.loadAnnotation(params.userId, params.contentAnnotationId);
    if (!annotation) return;

    // ステージに応じた提案を決定（1→[1], 2→[1,2], 3→[1,2,3], 4→[1,2,3,4]）
    const stagesToRun = this.getStagesToRun(params.currentSuggestionStage);

    // 取得系
    const wpContent = await this.fetchWpContent(
      annotation.wp_post_id,
      annotation.wp_content_text,
      params.userId
    );

    // 提案とスキップメッセージを格納（順序を維持）
    const orderedSuggestions: Array<{
      stage: number;
      templateName: SuggestionTemplate;
      label: string;
      task?: Promise<{ templateName: SuggestionTemplate; text: string } | null>;
      skipMessage?: string;
    }> = [];

    // ステージ1: CTR改善（広告スニペット）
    if (stagesToRun.includes(1)) {
      if (annotation.ads_headline || annotation.ads_description) {
        orderedSuggestions.push({
          stage: 1,
          templateName: 'gsc_insight_ctr_boost',
          label: MODEL_CONFIGS['gsc_insight_ctr_boost']?.label ?? 'gsc_insight_ctr_boost',
          task: this.runOne({
            templateName: 'gsc_insight_ctr_boost',
            variables: {
              adsHeadline: annotation.ads_headline || '',
              adsDescription: annotation.ads_description || '',
            },
          }),
        });
      } else {
        orderedSuggestions.push({
          stage: 1,
          templateName: 'gsc_insight_ctr_boost',
          label: MODEL_CONFIGS['gsc_insight_ctr_boost']?.label ?? 'gsc_insight_ctr_boost',
          skipMessage: '広告タイトル・説明文の情報が存在しないためスキップされました',
        });
      }
    }

    // ステージ2: 導入文改善
    if (stagesToRun.includes(2)) {
      if (annotation.opening_proposal) {
        orderedSuggestions.push({
          stage: 2,
          templateName: 'gsc_insight_intro_refresh',
          label: MODEL_CONFIGS['gsc_insight_intro_refresh']?.label ?? 'gsc_insight_intro_refresh',
          task: this.runOne({
            templateName: 'gsc_insight_intro_refresh',
            variables: {
              openingProposal: annotation.opening_proposal || '',
            },
          }),
        });
      } else {
        orderedSuggestions.push({
          stage: 2,
          templateName: 'gsc_insight_intro_refresh',
          label: MODEL_CONFIGS['gsc_insight_intro_refresh']?.label ?? 'gsc_insight_intro_refresh',
          skipMessage: '書き出し案の情報が存在しないためスキップされました',
        });
      }
    }

    // ステージ3: 本文リライト
    if (stagesToRun.includes(3)) {
      if (wpContent) {
        orderedSuggestions.push({
          stage: 3,
          templateName: 'gsc_insight_body_rewrite',
          label: MODEL_CONFIGS['gsc_insight_body_rewrite']?.label ?? 'gsc_insight_body_rewrite',
          task: this.runOne({
            templateName: 'gsc_insight_body_rewrite',
            variables: {
              wpContent,
            },
          }),
        });
      } else {
        orderedSuggestions.push({
          stage: 3,
          templateName: 'gsc_insight_body_rewrite',
          label: MODEL_CONFIGS['gsc_insight_body_rewrite']?.label ?? 'gsc_insight_body_rewrite',
          skipMessage: '本文の情報が存在しないためスキップされました',
        });
      }
    }

    // ステージ4: ペルソナから全て変更
    if (stagesToRun.includes(4)) {
      if (annotation.persona || annotation.needs) {
        orderedSuggestions.push({
          stage: 4,
          templateName: 'gsc_insight_persona_rebuild',
          label:
            MODEL_CONFIGS['gsc_insight_persona_rebuild']?.label ?? 'gsc_insight_persona_rebuild',
          task: this.runOne({
            templateName: 'gsc_insight_persona_rebuild',
            variables: {
              persona: annotation.persona || '',
              contentNeeds: annotation.needs || '',
            },
          }),
        });
      } else {
        orderedSuggestions.push({
          stage: 4,
          templateName: 'gsc_insight_persona_rebuild',
          label:
            MODEL_CONFIGS['gsc_insight_persona_rebuild']?.label ?? 'gsc_insight_persona_rebuild',
          skipMessage: 'ペルソナまたはニーズ情報が存在しないためスキップされました',
        });
      }
    }

    // タスクを並列実行
    const tasksToRun = orderedSuggestions.filter(s => s.task).map(s => s.task!);
    const results = await Promise.allSettled(tasksToRun);

    // 結果をマージ（順序を維持）
    const sections: string[] = [];
    let resultIndex = 0;

    for (const suggestion of orderedSuggestions) {
      if (suggestion.task) {
        const result = results[resultIndex++];
        if (result && result.status === 'fulfilled' && result.value) {
          sections.push(`# ${suggestion.label}\n\n${result.value.text}`);
        }
      } else if (suggestion.skipMessage) {
        sections.push(`# ${suggestion.label}\n\n※ ${suggestion.skipMessage}`);
      }
    }

    if (sections.length > 0) {
      const suggestionSummary = sections.join('\n\n---\n\n');
      const client = this.supabase.getClient();
      await client
        .from('gsc_article_evaluation_history')
        .update({ suggestion_summary: suggestionSummary })
        .eq('id', params.evaluationHistoryId)
        .eq('user_id', params.userId);
    }
  }

  /**
   * ステージに応じて実行する提案番号の配列を返す
   * @param currentStage 現在のステージ（1-4）
   * @returns 実行する提案番号の配列（例: stage=2 → [1, 2]）
   */
  private getStagesToRun(currentStage: number): number[] {
    return Array.from({ length: currentStage }, (_, i) => i + 1);
  }

  private async runOne({
    templateName,
    variables,
  }: {
    templateName: SuggestionTemplate;
    variables: Record<string, string>;
  }): Promise<{ templateName: SuggestionTemplate; text: string } | null> {
    const template = await PromptService.getTemplateByName(templateName);
    if (!template) return null;

    const modelConfig = MODEL_CONFIGS[templateName];
    if (!modelConfig) return null;

    const filled = PromptService.replaceVariables(template.content, variables);
    const provider = modelConfig.provider;
    const model = modelConfig.actualModel;

    const fullText = await llmChat(provider, model, [{ role: 'user', content: filled }], {
      maxTokens: modelConfig.maxTokens,
      temperature: modelConfig.temperature,
    });

    return { templateName, text: fullText };
  }

  private async loadAnnotation(userId: string, annotationId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('content_annotations')
      .select(
        'id, wp_post_id, ads_headline, ads_description, opening_proposal, wp_content_text, persona, needs'
      )
      .eq('user_id', userId)
      .eq('id', annotationId)
      .maybeSingle();
    if (error) {
      console.error('[GscSuggestion] annotation fetch error', error);
      return null;
    }
    return data as {
      id: string;
      wp_post_id: number | null;
      ads_headline: string | null;
      ads_description: string | null;
      opening_proposal: string | null;
      wp_content_text: string | null;
      persona: string | null;
      needs: string | null;
    } | null;
  }

  private async fetchWpContent(
    wpPostId: number | null,
    cachedContent: string | null,
    userId: string
  ): Promise<string | null> {
    if (cachedContent && cachedContent.trim().length > 0) {
      return cachedContent;
    }
    if (!wpPostId) return null;

    try {
      const wpSettings = await this.supabase.getWordPressSettingsByUserId(userId);
      if (!wpSettings) return null;

      // self-hosted: アプリケーションパスワードで直接取得
      if (wpSettings.wpType === 'self_hosted') {
        const ctx = buildWordPressServiceFromSettings(wpSettings, () => undefined);
        if (!ctx.success) return null;
        const post = await ctx.service.resolveContentById(wpPostId);
        if (!post.success || !post.data) return null;
        const rawContent = post.data.content;
        const contentHtml =
          typeof rawContent === 'string'
            ? rawContent
            : typeof (rawContent as { rendered?: unknown })?.rendered === 'string'
              ? (rawContent as { rendered: string }).rendered
              : '';
        const text = stripHtml(contentHtml).trim();

        if (text) {
          await this.supabase
            .getClient()
            .from('content_annotations')
            .update({ wp_content_text: text, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('wp_post_id', wpPostId);
        }
        return text || null;
      }

      // WordPress.com: アクセストークンを利用・期限切れならリフレッシュ
      let accessToken = wpSettings.wpAccessToken ?? null;
      // 期限切れならリフレッシュ（buffer 60秒）
      const expiresAt = wpSettings.wpTokenExpiresAt
        ? new Date(wpSettings.wpTokenExpiresAt).getTime()
        : null;
      if (accessToken && expiresAt && expiresAt - Date.now() < 60 * 1000) {
        const refreshed = await this.supabase.refreshWpComToken(userId, wpSettings);
        if (refreshed.success) {
          accessToken = refreshed.accessToken;
          wpSettings.wpAccessToken = refreshed.accessToken ?? null;
          wpSettings.wpRefreshToken = refreshed.refreshToken ?? wpSettings.wpRefreshToken ?? null;
          wpSettings.wpTokenExpiresAt = refreshed.expiresAt ?? wpSettings.wpTokenExpiresAt ?? null;
        } else {
          accessToken = null;
        }
      }

      if (!accessToken) {
        // WordPress.comだが有効なトークンがない
        return null;
      }

      const ctx = buildWordPressServiceFromSettings(wpSettings, name =>
        name === WPCOM_TOKEN_COOKIE_NAME ? accessToken : undefined
      );
      if (!ctx.success) return null;

      const post = await ctx.service.resolveContentById(wpPostId);
      if (!post.success || !post.data) return null;

      const rawContent = post.data.content;
      const contentHtml =
        typeof rawContent === 'string'
          ? rawContent
          : typeof (rawContent as { rendered?: unknown })?.rendered === 'string'
            ? (rawContent as { rendered: string }).rendered
            : '';
      const text = stripHtml(contentHtml).trim();

      if (text) {
        await this.supabase
          .getClient()
          .from('content_annotations')
          .update({ wp_content_text: text, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('wp_post_id', wpPostId);
      }

      return text || null;
    } catch (error) {
      console.error('[GscSuggestion] fetchWpContent error', error);
      return null;
    }
  }
}

export const gscSuggestionService = new GscSuggestionService();
