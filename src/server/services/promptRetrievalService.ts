import { PromptChunkService } from './promptChunkService';
import { PromptService } from '@/services/promptService';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { env } from '@/env';
import { OpenAIReranker } from '@/lib/reranker'; // リランカーをインポート
import { QueryExpansionService } from './queryExpansionService';

const openaiProvider = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export class PromptRetrievalService {
  /**
   * 指定されたプロンプトテンプレートから関連チャンクを取得（リランキング対応）
   */
  static async getChunks(
    templateName: string,
    queryText: string,
    limit: number = 8 // 最終的に必要なチャンク数
  ): Promise<string[]> {
    try {
      const reranker = new OpenAIReranker();
      const initialRetrieveCount = 50; // カスケード検索：より多くの候補を取得

      // テンプレートIDを取得
      const template = await PromptService.getTemplateByName(templateName);
      if (!template) {
        console.warn(`テンプレート '${templateName}' が見つかりません`);
        return [];
      }

      // 1. 初期検索で関連性が高そうなチャンクを多めに取得
      const initialChunks = await PromptChunkService.searchSimilarChunks(
        template.id,
        queryText,
        initialRetrieveCount
      );

      const chunkTexts = initialChunks.map(chunk => chunk.chunk_text);
      if (chunkTexts.length === 0) {
        return [];
      }

      // 2. OpenAIRerankerで再ランキング
      console.log(`[Reranker] ${chunkTexts.length}件のチャンクをリランキングします...`);
      const rerankedResults = await reranker.rerank(queryText, chunkTexts, {
        topK: limit, // 最終的に必要な数だけ選択
      });

      console.log(
        '[Reranker] リランキング後のスコア:',
        rerankedResults.map(r => r.score)
      );

      // 3. スコアの高いチャンクテキストのみを抽出
      return rerankedResults.map(result => result.document);
    } catch (error) {
      console.error('RAGチャンク取得・リランクエラー:', error);
      // エラー時はフォールバックとして、単純な検索結果を返す
      const template = await PromptService.getTemplateByName(templateName);
      if (template) {
        const chunks = await PromptChunkService.searchSimilarChunks(template.id, queryText, limit);
        return chunks.map(chunk => chunk.chunk_text);
      }
      return [];
    }
  }

  /**
   * マルチクエリ検索対応版のチャンク取得
   */
  static async getChunksWithMultiQuery(
    templateName: string,
    queryText: string,
    limit: number = 8
  ): Promise<string[]> {
    try {
      const reranker = new OpenAIReranker();
      const initialRetrieveCount = 50;

      // テンプレートIDを取得
      const template = await PromptService.getTemplateByName(templateName);
      if (!template) {
        console.warn(`テンプレート '${templateName}' が見つかりません`);
        return [];
      }

      // 1. 関連クエリを生成
      const expandedQueries = await QueryExpansionService.generateRelatedQueries(queryText, 2);

      // 2. 検索関数を定義（template対応ハイブリッド検索）
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const searchFunction = async (searchQuery: string, _embedding: number[]) => {
        // template対応ハイブリッド検索を直接使用（post-filter不要）
        return await PromptChunkService.searchSimilarChunks(
          template.id,
          searchQuery,
          initialRetrieveCount,
          true // ハイブリッド検索を有効化
        );
      };

      // 3. マルチクエリ検索を実行
      const chunks = await QueryExpansionService.performMultiQuerySearch(
        queryText,
        expandedQueries,
        searchFunction
      );

      const chunkTexts = chunks.map(chunk => chunk.content);
      if (chunkTexts.length === 0) {
        return [];
      }

      // 4. OpenAIRerankerで再ランキング
      console.log(`[MultiQuery Reranker] ${chunkTexts.length}件のチャンクをリランキングします...`);
      const rerankedResults = await reranker.rerank(queryText, chunkTexts, {
        topK: limit,
      });

      console.log(
        '[MultiQuery Reranker] リランキング後のスコア:',
        rerankedResults.map(r => r.score)
      );

      return rerankedResults.map(result => result.document);
    } catch (error) {
      console.error('マルチクエリ検索エラー:', error);
      // フォールバック：通常の検索
      return await this.getChunks(templateName, queryText, limit);
    }
  }

  /**
   * RAG対応のシステムメッセージを構築
   */
  static async buildRagSystemMessage(
    templateName: string,
    userQuery: string,
    adHeadlines?: string[]
  ): Promise<string> {
    try {
      let retrievalQuery = userQuery;

      if (templateName === 'lp_draft_creation') {
        const genericQueries = ['お願いします', '事業者', 'LP作成してください', 'LP'];
        const isGeneric = genericQueries.some(q =>
          userQuery.toLowerCase().includes(q.toLowerCase())
        );

        if (isGeneric) {
          try {
            // HTTP fetchを廃止し、ここで直接 generateText を呼び出す
            const { text } = await generateText({
              model: openaiProvider('gpt-4.1-nano'),
              prompt: `あなたはRAGシステムの検索クエリ最適化専門家です。

ユーザーの入力「${userQuery}」を、ベクトル検索で最高のパフォーマンスを発揮できるように、具体的で意図が明確な検索クエリに変換してください。

**最重要セクション（クエリ生成時に必ず含めます）**
- 最優先指示（省略・違反不可）
- 特徴、選ばれる理由と説明文、差別化
- このサービスを受けるにあたってオススメの人をピックアップする
- 全体の出力形式、トンマナ

最適化された検索クエリのみを返してください。説明は不要です。`,
              maxTokens: 200,
              temperature: 0.3,
            });
            retrievalQuery = text.trim();
          } catch (error) {
            console.error('クエリ生成(generateText)でエラー:', error);
            // エラー時は固定文字列にフォールバック
            retrievalQuery = 'LPの構成 18パート構成の厳守 特徴、選ばれる理由と説明文、差別化 ベネフィットの羅列 このサービスを受けるにあたってオススメの人をピックアップする';
          }
        }
      }

      // クエリを組み立て（ユーザー入力 + 広告見出し + 最優先指示）
      if (templateName === 'lp_draft_creation') {
        // LP作成の場合は必ず「最優先指示」を検索クエリに含める
        retrievalQuery += ' 最優先指示 省略・違反不可 特徴、選ばれる理由と説明文、差別化 ベネフィットの羅列 このサービスを受けるにあたってオススメの人をピックアップする';
      }

      if (adHeadlines && adHeadlines.length > 0) {
        retrievalQuery += '\n広告見出し：' + adHeadlines.join(', ');
      }

      // 旧テンプレートを取得（詳細フォーマット指示を保持）
      const originalTemplate = (await PromptService.getTemplateByName(templateName))?.content ?? '';

      // 関連チャンクを取得
      const chunks = await this.getChunks(templateName, retrievalQuery, 8);

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

      // エラー時のフォールバック
      try {
        const template = await PromptService.getTemplateByName(templateName);
        return template?.content || '18パートでLPを生成してください。';
      } catch (fallbackError) {
        console.error('フォールバック取得エラー:', fallbackError);
        return '18パートでLPを生成してください。';
      }
    }
  }
}
