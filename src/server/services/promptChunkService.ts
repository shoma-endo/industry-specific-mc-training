import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/env';

// OpenAIクライアント
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

// Supabaseクライアント（サーバーサイド用）
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);

export interface PromptChunk {
  id: string;
  template_id: string;
  chunk_index: number;
  chunk_text: string;
  embedding: number[];
  updated_at: string;
}

export class PromptChunkService {
  private static readonly CHUNK_SIZE = 1200; // Claude推奨値に拡張
  private static readonly MIN_CHUNK_SIZE = 300; // 拡張

  /**
   * テキストをセマンティック境界を考慮してチャンクに分割（マークダウン対応）
   */
  private static splitTextIntoChunks(text: string): string[] {
    const lines = text.split('\n');
    const chunks: string[] = [];
    let currentChunkLines: string[] = [];

    for (const line of lines) {
      const isHeading = /^(#+\s*|^\d+\.\s)/.test(line.trim());
      if (isHeading && currentChunkLines.length > 0) {
        const chunk = currentChunkLines.join('\n').trim();
        if (chunk.length > 0) chunks.push(chunk);
        currentChunkLines = [line];
      } else {
        currentChunkLines.push(line);
      }
    }

    if (currentChunkLines.length > 0) {
      const chunk = currentChunkLines.join('\n').trim();
      if (chunk.length > 0) chunks.push(chunk);
    }

    const finalChunks: string[] = [];
    for (const chunk of chunks) {
      if (chunk.length > this.CHUNK_SIZE) {
        finalChunks.push(...this.splitBySentencesAndSize(chunk));
      } else {
        finalChunks.push(chunk);
      }
    }

    return finalChunks.filter(
      c => c.length >= this.MIN_CHUNK_SIZE || /^(#+\s*|^\d+\.\s)/.test(c.trim())
    );
  }

  /**
   * 文境界と文字数で分割するメソッド
   */
  private static splitBySentencesAndSize(text: string): string[] {
    const sentences = text.split(/(?<=[。！？])\s*/);
    const chunks: string[] = [];
    let currentChunk = '';
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (trimmedSentence.length === 0) continue;

      if ((currentChunk + ' ' + trimmedSentence).trim().length > this.CHUNK_SIZE) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
        }
        currentChunk = trimmedSentence;
      } else {
        currentChunk = (currentChunk + ' ' + trimmedSentence).trim();
      }
    }
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    return chunks;
  }

  /**
   * テキストの埋め込みベクトルを生成
   */
  private static async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small', // 1536次元モデル（データベース定義に合わせる）
        input: text,
        dimensions: 1536, // テーブル定義に合わせる
      });

      return response.data[0]?.embedding || [];
    } catch (error) {
      console.error('埋め込み生成エラー:', error);
      throw new Error('埋め込み生成に失敗しました');
    }
  }

  /**
   * プロンプトテンプレートのチャンクを更新
   */
  static async updatePromptChunks(templateId: string, content: string): Promise<void> {
    try {
      // 1. 既存のチャンクを削除
      const { error: deleteError } = await supabase
        .from('prompt_chunks')
        .delete()
        .eq('template_id', templateId);

      if (deleteError) {
        console.error('既存チャンク削除エラー:', deleteError);
        throw new Error('既存チャンクの削除に失敗しました');
      }

      // 2. テキストをチャンクに分割
      const chunks = this.splitTextIntoChunks(content);

      // ===== デバッグログを追加 =====
      console.log(`[updatePromptChunks] 分割後のチャンク数: ${chunks.length}`);
      if (chunks.length > 0) {
        console.log('[updatePromptChunks] 生成されたチャンク内容:');
        chunks.forEach((chunk, i) => {
          console.log(`--- チャンク ${i + 1} (長さ: ${chunk.length}) ---`);
          console.log(chunk);
          console.log('--------------------');
        });
      } else {
        console.warn(
          '[updatePromptChunks] 注意: チャンクが1つも生成されませんでした。プロンプトの形式を確認してください。'
        );
      }
      // ===== デバッグログここまで =====

      // 3. 各チャンクの埋め込みを並列生成
      const embeddingPromises = chunks.map(async (chunk, i) => {
        if (!chunk || chunk.trim().length === 0) {
          console.error(`チャンク${i}が空です`);
          return null;
        }

        try {
          const embedding = await this.generateEmbedding(chunk);
          if (!embedding || embedding.length === 0) {
            console.error(`チャンク${i}の埋め込み生成失敗`);
            return null;
          }

          return {
            template_id: templateId,
            chunk_index: i,
            chunk_text: chunk,
            embedding,
          };
        } catch (error) {
          console.error(`チャンク${i}の埋め込み生成エラー:`, error);
          return null;
        }
      });

      // 並列実行（OpenAI Rate Limitに配慮して3並列に制限）
      const batchSize = 3;
      const validChunks = [];

      for (let i = 0; i < embeddingPromises.length; i += batchSize) {
        const batch = embeddingPromises.slice(i, i + batchSize);
        const results = await Promise.all(batch);
        validChunks.push(...results.filter(chunk => chunk !== null));
      }

      // 4. DBに一括保存
      if (validChunks.length > 0) {
        const { error: insertError } = await supabase.from('prompt_chunks').insert(validChunks);

        if (insertError) {
          console.error('チャンク一括保存エラー:', insertError);
          throw new Error('チャンクの保存に失敗しました');
        }
      }

      console.log(`プロンプトテンプレート ${templateId} のチャンク更新完了: ${chunks.length}個`);
    } catch (error) {
      console.error('プロンプトチャンク更新エラー:', error);
      throw error;
    }
  }

  /**
   * 類似チャンクを検索
   */
  static async searchSimilarChunks(
    templateId: string,
    queryText: string,
    limit: number = 4
  ): Promise<PromptChunk[]> {
    try {
      // クエリの埋め込みを生成
      const queryEmbedding = await this.generateEmbedding(queryText);

      // ベクトル検索実行
      const { data, error } = await supabase.rpc('search_prompt_chunks', {
        template_id: templateId,
        query_embedding: queryEmbedding,
        similarity_threshold: 0.3, // やや緩くしてヒット率を上げる
        match_count: limit,
      });

      if (error) {
        console.error('チャンク検索エラー:', error);
        return this.getAllChunks(templateId, limit);
      }

      // 検索結果がゼロの場合もフォールバック
      if (!data || data.length === 0) {
        console.warn('類似チャンクが見つからないため全チャンクを返します');
        return this.getAllChunks(templateId, limit);
      }

      return data;
    } catch (error) {
      console.error('類似チャンク検索エラー:', error);
      // フォールバック: 全チャンクを取得
      return this.getAllChunks(templateId, limit);
    }
  }

  /**
   * フォールバック用: 全チャンクを取得
   */
  private static async getAllChunks(templateId: string, limit: number): Promise<PromptChunk[]> {
    try {
      const { data, error } = await supabase
        .from('prompt_chunks')
        .select('*')
        .eq('template_id', templateId)
        .order('chunk_index')
        .limit(limit);

      if (error) {
        console.error('全チャンク取得エラー:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('フォールバック取得エラー:', error);
      return [];
    }
  }
}
