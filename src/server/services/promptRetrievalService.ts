import { PromptChunkService } from './promptChunkService';
import { PromptService } from '@/services/promptService';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { env } from '@/env';

const openaiProvider = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export class PromptRetrievalService {
  /**
   * 指定されたプロンプトテンプレートから関連チャンクを取得
   */
  static async getChunks(
    templateName: string,
    queryText: string,
    limit: number = 4
  ): Promise<string[]> {
    try {
      // テンプレートIDを取得
      const template = await PromptService.getTemplateByName(templateName);
      if (!template) {
        console.warn(`テンプレート '${templateName}' が見つかりません`);
        return [];
      }

      // 関連チャンクを検索
      const chunks = await PromptChunkService.searchSimilarChunks(template.id, queryText, limit);

      // チャンクテキストのみを抽出
      return chunks.map(chunk => chunk.chunk_text);
    } catch (error) {
      console.error('RAGチャンク取得エラー:', error);
      return [];
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
        const genericQueries = ['お願いします', 'こんにちは', 'LP作成してください', 'LP'];
        const isGeneric = genericQueries.some(q =>
          userQuery.toLowerCase().includes(q.toLowerCase())
        );

        if (isGeneric) {
          try {
            // HTTP fetchを廃止し、ここで直接 generateText を呼び出す
            const { text } = await generateText({
              model: openaiProvider('gpt-4o-mini'),
              prompt: `あなたはRAGシステムの検索クエリ最適化専門家です。

ユーザーの入力「${userQuery}」を、ベクトル検索で最高のパフォーマンスを発揮できるように、具体的で意図が明確な検索クエリに変換してください。

対象タスク：ランディングページ（LP）の構成要素とドラフト作成

**最重要セクション（クエリ生成時に必ず考慮すること）：**
- 特徴、選ばれる理由、差別化要素
- 最優先指示、禁止事項
- 全体の出力形式、トンマナ

最適化された検索クエリのみを返してください。説明は不要です。`,
              maxTokens: 200,
              temperature: 0.3,
            });
            retrievalQuery = text.trim();
          } catch (error) {
            console.error('クエリ生成(generateText)でエラー:', error);
            // エラー時は固定文字列にフォールバック
            retrievalQuery =
              'LPの構成要素、特に「特徴・選ばれる理由」と、全体の「出力形式」や「最優先指示」に関する詳細な指示';
          }
        }
      }

      // クエリを組み立て（ユーザー入力 + 広告見出し）
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

        const systemPrompt = `あなたは、与えられた指示とナレッジに厳密に従ってランディングページ（LP）のドラフトを作成するプロのコピーライターです。

# 指示
- 提供された「ナレッジ」に含まれるLPの構成、パート分け、フォーマット、トーン＆マナーの指示に**絶対に、厳密に**従ってください。
- あなた自身の知識や創造性は、ナレッジで許可された範囲でのみ発揮してください。指示にないパートを追加したり、既存のパートを省略したりしないでください。
- 全体を通して、指定されたトンマナを一貫して維持してください。

# ナレッジ
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
