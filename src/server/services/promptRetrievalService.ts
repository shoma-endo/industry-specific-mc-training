import { PromptChunkService } from './promptChunkService';
import { PromptService } from '@/services/promptService';

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
          retrievalQuery =
            'LPの構成要素、特に「特徴・選ばれる理由」と、全体の「出力形式」や「最優先指示」に関する詳細な指示';
        }
      }

      // クエリを組み立て（ユーザー入力 + 広告見出し）
      if (adHeadlines && adHeadlines.length > 0) {
        retrievalQuery += '\n広告見出し：' + adHeadlines.join(', ');
      }

      // 旧テンプレートを取得（詳細フォーマット指示を保持）
      const originalTemplate = (await PromptService.getTemplateByName(templateName))?.content ?? '';

      // 関連チャンクを取得
      const chunks = await this.getChunks(templateName, retrievalQuery, 4);

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
          .map((chunk, index) => `### ナレッジ${index + 1}\n${chunk}`)
          .join('\n\n');

        return `## LP生成ナレッジ\n${chunkSection}\n\n${originalTemplate}`;
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
