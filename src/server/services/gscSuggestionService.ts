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
  | 'gsc_insight_body_rewrite';

const TEMPLATE_LABELS: Record<SuggestionTemplate, string> = {
  gsc_insight_ctr_boost: '広告タイトル・説明文の提案',
  gsc_insight_intro_refresh: '書き出し案の提案',
  gsc_insight_body_rewrite: '本文の提案',
};

interface GenerateParams {
  userId: string;
  contentAnnotationId: string;
  evaluationId: string;
  evaluationHistoryId: string;
  outcome: GscEvaluationOutcome;
  currentPosition: number | null;
  previousPosition: number | null;
}

export class GscSuggestionService {
  private supabase = new SupabaseService();

  async generate(params: GenerateParams): Promise<void> {
    // outcome improved の場合は呼ばれない想定
    const annotation = await this.loadAnnotation(params.userId, params.contentAnnotationId);
    if (!annotation) return;

    // 取得系
    const wpContent = await this.fetchWpContent(
      annotation.wp_post_id,
      annotation.wp_content_text,
      params.userId
    );

    const tasks: Array<Promise<{ templateName: SuggestionTemplate; text: string } | null>> = [];

    // CTR改善（広告スニペット）
    if (annotation.ads_headline || annotation.ads_description) {
      tasks.push(
        this.runOne({
          templateName: 'gsc_insight_ctr_boost',
          variables: {
            adsHeadline: annotation.ads_headline || '',
            adsDescription: annotation.ads_description || '',
          },
        })
      );
    }

    // 導入文改善
    if (annotation.opening_proposal) {
      tasks.push(
        this.runOne({
          templateName: 'gsc_insight_intro_refresh',
          variables: {
            openingProposal: annotation.opening_proposal || '',
          },
        })
      );
    }

    // 本文リライト
    if (wpContent) {
      tasks.push(
        this.runOne({
          templateName: 'gsc_insight_body_rewrite',
          variables: {
            wpContent,
          },
        })
      );
    }

    const results = await Promise.allSettled(tasks);

    // 結果を組み合わせてマークダウン形式でDBに保存
    const sections: string[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        const { templateName, text } = result.value;
        const label = TEMPLATE_LABELS[templateName];
        sections.push(`# ${label}\n\n${text}`);
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
      .select('id, wp_post_id, ads_headline, ads_description, opening_proposal, wp_content_text')
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
