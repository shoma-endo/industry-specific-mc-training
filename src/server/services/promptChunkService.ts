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
  private static readonly CHUNK_OVERLAP = 100; // 維持
  private static readonly MIN_CHUNK_SIZE = 300; // 拡張

  /**
   * テキストをセマンティック境界を考慮してチャンクに分割
   */
  private static splitTextIntoChunks(text: string): string[] {
    // セマンティック分割を試行
    const semanticChunks = this.splitTextSemanticAware(text);

    // セマンティック分割で十分な場合はそのまま返す
    if (semanticChunks.every(chunk => chunk.length <= this.CHUNK_SIZE)) {
      return semanticChunks;
    }

    // 大きなチャンクは従来の方法で分割
    const finalChunks: string[] = [];

    for (const chunk of semanticChunks) {
      if (chunk.length <= this.CHUNK_SIZE) {
        finalChunks.push(chunk);
      } else {
        const subChunks = this.splitTextByFixedSize(chunk);
        finalChunks.push(...subChunks);
      }
    }

    return finalChunks.filter(chunk => chunk.length >= this.MIN_CHUNK_SIZE);
  }

  /**
   * セマンティック境界を考慮した分割
   */
  private static splitTextSemanticAware(text: string): string[] {
    // 段落境界で分割
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    if (paragraphs.length <= 1) {
      // 段落がない場合は文境界で分割
      return this.splitBySentences(text);
    }

    const chunks: string[] = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      const potentialChunk = currentChunk + (currentChunk ? '\n\n' : '') + paragraph;

      if (potentialChunk.length <= this.CHUNK_SIZE) {
        currentChunk = potentialChunk;
      } else {
        // 現在のチャンクを保存
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }

        // 段落が大きすぎる場合は文で分割
        if (paragraph.length > this.CHUNK_SIZE) {
          const sentenceChunks = this.splitBySentences(paragraph);
          chunks.push(...sentenceChunks);
          currentChunk = '';
        } else {
          currentChunk = paragraph;
        }
      }
    }

    // 最後のチャンクを追加
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * 文境界で分割
   */
  private static splitBySentences(text: string): string[] {
    // 日本語の文境界（。！？）を考慮
    const sentences = text.split(/(?<=[。！？])\s*/).filter(s => s.trim().length > 0);

    if (sentences.length <= 1) {
      return [text];
    }

    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const potentialChunk = currentChunk + sentence;

      if (potentialChunk.length <= this.CHUNK_SIZE) {
        currentChunk = potentialChunk;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * 固定サイズでの分割（フォールバック用）
   */
  private static splitTextByFixedSize(text: string): string[] {
    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      const endIndex = Math.min(startIndex + this.CHUNK_SIZE, text.length);
      const chunk = text.slice(startIndex, endIndex);
      chunks.push(chunk.trim());

      // 最後のチャンクの場合は終了
      if (endIndex >= text.length) break;

      // 次のチャンクの開始位置（オーバーラップ考慮）
      startIndex = endIndex - this.CHUNK_OVERLAP;
    }

    return chunks.filter(chunk => chunk.length > 0);
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
