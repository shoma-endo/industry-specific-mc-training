import { cache } from 'react';

import { MODEL_CONFIGS } from '@/lib/constants';
import { llmChat } from '@/server/services/llmService';
import { PromptService } from '@/server/services/promptService';
import { PromptChunkService } from './promptChunkService';

export class PromptRetrievalService {
  /**
   * キャッシュ化されたチャンク取得関数
   * 同じクエリに対しては同一リクエスト中で結果を再利用
   */
  static getCachedChunks = cache(
    async (templateId: string, queryText: string, limit: number = 6): Promise<string[]> => {
      return this.getChunks(templateId, queryText, limit);
    }
  );

  /**
   * 指定されたプロンプトテンプレートから関連チャンクを取得（リランキング対応）
   */
  static async getChunks(
    templateId: string,
    queryText: string,
    limit: number = 8 // 最終的に必要なチャンク数
  ): Promise<string[]> {
    if (!templateId) {
      console.warn('テンプレートIDが未指定のため、チャンク検索をスキップします');
      return [];
    }

    try {
      // 初期取得数を最適化（50 → 20に削減）
      const initialRetrieveCount = Math.max(20, limit * 2);

      // 1. 初期検索で関連性が高そうなチャンクを取得
      const initialChunks = await PromptChunkService.searchSimilarChunks(
        templateId,
        queryText,
        initialRetrieveCount
      );

      const chunkTexts = initialChunks.map(chunk => chunk.chunk_text);
      if (chunkTexts.length === 0) {
        return [];
      }

      // 2. リランキング処理を廃止し、先頭から必要数のみ返す
      return chunkTexts.slice(0, limit);
    } catch (error) {
      console.error('RAGチャンク取得・リランクエラー:', error);
      // エラー時はフォールバックとして、単純な検索結果を返す
      try {
        const chunks = await PromptChunkService.searchSimilarChunks(templateId, queryText, limit);
        return chunks.map(chunk => chunk.chunk_text);
      } catch (fallbackError) {
        console.error('フォールバック検索でもエラーが発生しました:', fallbackError);
        return [];
      }
    }
  }

  /**
   * RAG対応のシステムメッセージを構築
   */
  static async buildRagSystemMessage(
    templateName: string,
    userQuery: string,
    adHeadlines?: string[],
    options: { skipQueryOptimization?: boolean } = {}
  ): Promise<string> {
    const template = await PromptService.getTemplateByName(templateName);
    const originalTemplate = template?.content ?? '';

    if (!template) {
      console.warn(`テンプレート '${templateName}' が見つからないため、RAG検索をスキップします`);
    }

    try {
      let retrievalQuery = userQuery;

      if (templateName === 'lp_draft_creation') {
        const genericQueries = ['お願いします', '事業者', 'LP作成してください', 'LP'];
        const isGeneric = genericQueries.some(q =>
          userQuery.toLowerCase().includes(q.toLowerCase())
        );

        if (isGeneric) {
          // 高速化オプション: クエリ最適化をスキップ
          if (options.skipQueryOptimization) {
            console.log('[Fast Mode] クエリ最適化をスキップ、事前定義クエリを使用');
            retrievalQuery =
              'LPの構成 18パート構成の厳守 特徴、選ばれる理由と説明文、差別化 ベネフィットの羅列 このサービスを受けるにあたってオススメの人をピックアップする';
          } else {
            try {
              const { provider, actualModel } = MODEL_CONFIGS['ad_copy_finishing'] ?? {
                provider: 'anthropic' as const,
                actualModel: 'claude-sonnet-4-20250514',
              };

              const text = await llmChat(
                provider,
                actualModel,
                [
                  {
                    role: 'user',
                    content: `あなたはRAGシステムの検索クエリ最適化専門家です。

ユーザーの入力「${userQuery}」を、ベクトル検索で最高のパフォーマンスを発揮できるように、具体的で意図が明確な検索クエリに変換してください。

**最重要セクション（クエリ生成時に必ず含めます）**
- 最優先指示（省略・違反不可）
- 特徴、選ばれる理由と説明文、差別化
- このサービスを受けるにあたってオススメの人をピックアップする
- 全体の出力形式、トンマナ

最適化された検索クエリのみを返してください。説明は不要です。`,
                  },
                ],
                { maxTokens: 200, temperature: 0.3 }
              );
              retrievalQuery = text.trim();
            } catch (error) {
              console.error('クエリ生成(llmChat)でエラー:', error);
              retrievalQuery =
                'LPの構成 18パート構成の厳守 特徴、選ばれる理由と説明文、差別化 ベネフィットの羅列 このサービスを受けるにあたってオススメの人をピックアップする';
            }
          }
        }
      }

      // クエリを組み立て（ユーザー入力 + 広告見出し + 最優先指示）
      if (templateName === 'lp_draft_creation') {
        // LP作成の場合は必ず「最優先指示」を検索クエリに含める
        retrievalQuery +=
          ' 最優先指示 省略・違反不可 特徴、選ばれる理由と説明文、差別化 ベネフィットの羅列 このサービスを受けるにあたってオススメの人をピックアップする';
      }

      if (adHeadlines && adHeadlines.length > 0) {
        retrievalQuery += '\n広告見出し：' + adHeadlines.join(', ');
      }

      // 関連チャンクを取得（キャッシュ化、件数を6に最適化）
      const chunks = template ? await this.getCachedChunks(template.id, retrievalQuery, 6) : [];

      // ===== デバッグログ =====
      try {
        console.log('[PromptRetrievalService] テンプレート:', templateName);
        console.log('[PromptRetrievalService] 検索クエリ:', retrievalQuery);
        console.log('[PromptRetrievalService] 取得チャンク数:', chunks.length);
        if (chunks.length > 0) {
          console.log('[PromptRetrievalService] チャンクプレビュー (全文):', chunks);
        }
      } catch {
        /* noop */
      }
      // ===== デバッグログここまで =====

      // チャンクが取得できた場合はナレッジを前置し、後ろに元テンプレ全文を連結
      if (chunks.length > 0) {
        const chunkSection = chunks
          .map((chunk, index) => `### 提供ナレッジ ${index + 1}\n${chunk}`)
          .join('\n\n');

        // 必ず含めたい固定フォーマット（特徴・選ばれる理由…）
        const fixedFeatureSection = `## 必須フォーマット: 特徴・選ばれる理由
7. 特徴、選ばれる理由と説明文、差別化
**選ばれる理由の前に、「この選ばれる理由がいかに重要なのか？」がわかる誘導文を200文字程度入れてください。**
・ほかではなく、これがほしい
・選ばれる理由は最大6つまでにする
例）
  ・小見出し1\n  詳細説明（100文字程度）\n  ・小見出し2\n  詳細説明（100文字程度）`;

        const systemPrompt = `あなたは、与えられた指示とナレッジに厳密に従ってランディングページ（LP）のドラフトを作成するプロのコピーライターです。

# 指示
- 提供された「ナレッジ」に含まれるLPの構成、パート分け、フォーマット、トーン＆マナーの指示に**絶対に、厳密に**従ってください。
- あなた自身の知識や創造性は、ナレッジで許可された範囲でのみ発揮してください。指示にないパートを追加したり、既存のパートを省略したりしないでください。
- 全体を通して、指定されたトンマナを一貫して維持してください。

# ナレッジ
${fixedFeatureSection}

${chunkSection}

---
${originalTemplate}
---

以上の指示とナレッジに基づき、ユーザーの要求から最高のLPドラフトを生成してください。`;
        return systemPrompt;
      }

      // チャンク無し: 旧テンプレのみ
      if (originalTemplate) {
        return originalTemplate;
      }

      // 最終フォールバック
      return '18パートでLPを生成してください。';
    } catch (error) {
      console.error('RAGシステムメッセージ構築エラー:', error);

      if (originalTemplate) {
        return originalTemplate;
      }

      return '18パートでLPを生成してください。';
    }
  }
}
