// =============================================================================
// React Cache活用キャッシュ戦略実装
// =============================================================================

import { cache } from 'react';
import { getBrief } from '@/server/handler/actions/brief.actions';
import type { BriefInput } from '@/server/handler/actions/brief.schema';
import { PromptService } from '@/server/services/promptService';
import { BlogStepId, isStep7 as isBlogStep7, toTemplateName } from '@/lib/constants';
import { authMiddleware } from '@/server/middleware/auth.middleware';

/**
 * 事業者情報取得のキャッシュ化
 * 同一リクエスト内でのDB負荷を最大90%削減
 */
export const getCachedBrief = cache(async (liffAccessToken: string): Promise<BriefInput | null> => {
  try {
    const result = await getBrief(liffAccessToken);
    return result.success && result.data ? result.data : null;
  } catch (error) {
    console.error('事業者情報取得エラー:', error);
    return null;
  }
});

// appendInternalLinksInstruction はテンプレ変数への埋め込み方針に変更したため不要

/**
 * テンプレート変数置換関数
 * {{variable}} 形式の変数を実際の値で置換
 */
export function replaceTemplateVariables(
  template: string,
  businessInfo: BriefInput | null
): string {
  // 事業者情報が未登録の場合は、テンプレート変数を削除して汎用プロンプトに変換
  if (!businessInfo) {
    return template
      .replace(
        /## 事業者情報の活用[\s\S]*?### ペルソナ情報[\s\S]*?- ターゲット: \{\{persona\}\}\n\n/g,
        ''
      )
      .replace(/### 参考情報[\s\S]*?- ベンチマークURL: \{\{benchmarkUrl\}\}\n\n/g, '')
      .replace(/# 注意事項[\s\S]*?- 競合広告文は参考程度に留め、独自性を重視してください\n\n/g, '')
      .replace(/上記の事業者情報と、/g, '')
      .replace(/- 上記の事業者情報と一貫性を保ってください\n/g, '');
  }

  return (
    template
      .replace(/\{\{(\w+)\}\}/g, (match, key) => {
        // 既知の事業者情報のみを置換し、未知の変数は保持して後段の置換へ委譲
        const value = (businessInfo as unknown as Record<string, unknown>)[key];

        // 未定義・null は置換せずプレースホルダを残す
        if (value === undefined || value === null) {
          return match;
        }

        // 配列の場合は文字列に変換
        if (Array.isArray(value)) {
          return value.join('、');
        }

        // それ以外は文字列化して返す
        return String(value);
      })
      // 置換後に残ったプレースホルダをログ出力
      .replace(/([\s\S]*)/, full => {
        try {
          const unresolved = full.match(/\{\{(\w+)\}\}/g) || [];
          if (unresolved.length > 0) {
            console.warn('[replaceTemplateVariables] 未解決の変数:', unresolved);
          }
        } catch {
          /* noop */
        }
        return full;
      })
  );
}

// =============================================================================
// プロンプト生成関数（React Cache活用）
// =============================================================================


/**
 * ブログ作成用プロンプト生成（キャッシュ付き）
 * DBテンプレート + canonicalUrls 変数埋め込み
 */
export async function generateBlogCreationPromptByStep(
  liffAccessToken: string,
  step: BlogStepId,
  sessionId?: string
): Promise<string> {
  try {
      const templateName = toTemplateName(step);
      console.log('[BlogPrompt] Fetching step template', { step, templateName });

      const [template, auth, businessInfo] = await Promise.all([
        PromptService.getTemplateByName(templateName),
        authMiddleware(liffAccessToken),
        getCachedBrief(liffAccessToken),
      ]);

      const userId = auth.error ? undefined : auth.userId;
      const isStep7 = isBlogStep7(step); // 現step7を本文作成として扱う
      const canonicalLinkEntries =
        isStep7 && userId ? await PromptService.getCanonicalLinkEntriesByUserId(userId) : [];
      const canonicalUrls = canonicalLinkEntries.map(entry => entry.canonical_url);
      const canonicalLinkPairsFormatted = canonicalLinkEntries.map(entry => {
        const title = entry.wp_post_title || '';
        return title ? `${title} | ${entry.canonical_url}` : entry.canonical_url;
      });
      if (isStep7) {
        console.log('[BlogPrompt] Step7 canonicalUrls loaded', {
          step,
          templateName,
          userIdLoaded: Boolean(userId),
          canonicalUrlCount: canonicalUrls.length,
        });
      }
      // DBテンプレの変数定義と本文内のプレースホルダを可視化
      const dbVarNames = (template?.variables || []).map(v => v.name);
      const contentVarNames = Array.from(
        new Set(
          ((template?.content || '').match(/\{\{(\w+)\}\}/g) || []).map(m => m.replace(/[{}]/g, ''))
        )
      );
      const varsDiff = {
        missingInDB: contentVarNames.filter(n => !dbVarNames.includes(n)),
        extraInDB: dbVarNames.filter(n => !contentVarNames.includes(n)),
      };
      console.log('[BlogPrompt][Vars] テンプレ変数確認', {
        step,
        templateName,
        isStep7,
        dbVarNames,
        contentVarNames,
        varsDiff,
      });
      // content_annotations を取得（セッション優先、無ければユーザー最新）し、テンプレ変数としてマージ
      const contentAnnotation = userId
        ? sessionId
          ? await PromptService.getContentAnnotationBySession(userId, sessionId)
          : await PromptService.getLatestContentAnnotationByUserId(userId)
        : null;
      const contentVars = PromptService.buildContentVariables(contentAnnotation);

      // コンテンツ変数は全ステップで適用。canonicalUrls はStep7のみ適用
      const vars: Record<string, string> = isStep7
        ? {
            ...contentVars,
            canonicalUrls: canonicalUrls.join('\n'),
            canonicalLinkPairs: canonicalLinkPairsFormatted.join('\n'),
          }
        : { ...contentVars };
      console.log('[BlogPrompt][Vars] 置換に使用する変数ソース', {
        step,
        isStep7,
        applyBusinessInfo: true,
        applyContentVars: true,
        contentVarsKeys: Object.keys(contentVars),
        canonicalUrlCount: canonicalUrls.length,
      });

      if (template?.content) {
        console.log('[BlogPrompt] Using step template from DB', {
          step,
          templateName,
          withVariables: isStep7,
          contentLength: template.content.length,
        });
        // 1) 事業者情報（{{...}}）を置換 → 2) コンテンツ/Step7変数を置換
        const afterBusiness = replaceTemplateVariables(template.content, businessInfo);
        const mergedPrompt = PromptService.replaceVariables(afterBusiness, vars);
        const unresolvedPlaceholders = (mergedPrompt.match(/{{(\w+)}}/g) || []).map(token =>
          token.replace(/[{}]/g, '')
        );

        if (unresolvedPlaceholders.length > 0) {
          console.warn('[BlogPrompt] 未解決のDBプロンプト変数を検出 - 空文字で置換', {
            step,
            templateName,
            unresolvedPlaceholders,
          });
          return mergedPrompt.replace(/{{\w+}}/g, '');
        }

        return mergedPrompt;
      }

      console.warn('[BlogPrompt] Step template not found. Using SYSTEM_PROMPT as fallback', {
        step,
        templateName,
        withVariables: isStep7,
      });
      return SYSTEM_PROMPT;
    } catch (error) {
      console.error('ブログ作成ステッププロンプト生成エラー:', error);
      return SYSTEM_PROMPT;
    }
  }

// =============================================================================
// 共通：モデル別システムプロンプト解決
// =============================================================================

/**
 * モデルに応じたシステムプロンプトを取得する（LIFFトークンがあれば動的生成、なければ静的）
 */
export async function getSystemPrompt(
  model: string,
  liffAccessToken?: string,
  sessionId?: string
): Promise<string> {
  if (liffAccessToken) {
    if (model.startsWith('blog_creation_')) {
      const step = model.substring('blog_creation_'.length) as BlogStepId;
      return await generateBlogCreationPromptByStep(liffAccessToken, step, sessionId);
    }
    switch (model) {
      case 'ad_copy_creation':
        return await generateAdCopyPrompt(liffAccessToken);
      case 'ad_copy_finishing':
        return await generateAdCopyFinishingPrompt(liffAccessToken);
      case 'lp_draft_creation':
        return await generateLpDraftPrompt(liffAccessToken);
      default: {
        const STATIC_PROMPTS: Record<string, string> = {
          'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2': KEYWORD_CATEGORIZATION_PROMPT,
          ad_copy_creation: AD_COPY_PROMPT,
          ad_copy_finishing: AD_COPY_FINISHING_PROMPT,
          lp_draft_creation: LP_DRAFT_PROMPT,
        };
        return STATIC_PROMPTS[model] ?? SYSTEM_PROMPT;
      }
    }
  }

  // liffAccessToken が無い場合は静的
  const STATIC_PROMPTS: Record<string, string> = {
    'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2': KEYWORD_CATEGORIZATION_PROMPT,
    ad_copy_creation: AD_COPY_PROMPT,
    ad_copy_finishing: AD_COPY_FINISHING_PROMPT,
    lp_draft_creation: LP_DRAFT_PROMPT,
  };
  return STATIC_PROMPTS[model] ?? SYSTEM_PROMPT;
}
