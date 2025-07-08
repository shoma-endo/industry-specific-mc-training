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
  private static readonly OVERLAP_SIZE = 200; // オーバーラップサイズ

  /**
   * テキストをセマンティック境界を考慮してチャンクに分割（オーバーラップ対応）
   */
  private static splitTextIntoChunks(text: string): string[] {
    const lines = text.split('\n');
    const chunks: string[] = [];
    let currentChunkLines: string[] = [];

    for (const line of lines) {
      // 改善された見出し判定：【】で囲まれた重要セクションも含める
      const isHeading = /^(#+\s*|^\d+\.\s|^##\s*【.*】|^【.*】)/.test(line.trim());
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
        finalChunks.push(...this.splitBySentencesAndSizeWithOverlap(chunk));
      } else {
        finalChunks.push(chunk);
      }
    }

    return finalChunks.filter(
      c =>
        c.length >= this.MIN_CHUNK_SIZE ||
        /^(#+\s*|^\d+\.\s|^##\s*【.*】|^【.*】)/.test(c.trim()) ||
        c.includes('最優先指示') ||
        c.includes('省略・違反不可')
    );
  }

  /**
   * 文境界と文字数で分割するメソッド（オーバーラップ対応）
   */
  private static splitBySentencesAndSizeWithOverlap(text: string): string[] {
    const sentences = text.split(/(?<=[。！？])\s*/);
    const chunks: string[] = [];
    const seenChunks = new Set<string>(); // 重複検知用
    let currentChunk = '';
    let previousOverlap = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (trimmedSentence.length === 0) continue;

      if ((currentChunk + ' ' + trimmedSentence).trim().length > this.CHUNK_SIZE) {
        if (currentChunk.length > 0) {
          // チャンク長オーバーフロー防止：強制分割
          let finalChunk = currentChunk;
          while (finalChunk.length > this.CHUNK_SIZE) {
            const cutPoint = finalChunk.lastIndexOf(' ', this.CHUNK_SIZE);
            const chunk =
              cutPoint > 0
                ? finalChunk.substring(0, cutPoint)
                : finalChunk.substring(0, this.CHUNK_SIZE);

            // 重複チェック
            if (!seenChunks.has(chunk) && chunk.length >= this.MIN_CHUNK_SIZE) {
              chunks.push(chunk);
              seenChunks.add(chunk);
            }

            finalChunk = finalChunk.substring(cutPoint > 0 ? cutPoint + 1 : this.CHUNK_SIZE);
          }

          // 残りを追加
          if (finalChunk.length >= this.MIN_CHUNK_SIZE && !seenChunks.has(finalChunk)) {
            chunks.push(finalChunk);
            seenChunks.add(finalChunk);
          }

          // OVERLAP_SIZE定数を使用してオーバーラップを計算
          const overlapCharCount = Math.min(
            this.OVERLAP_SIZE,
            Math.floor(currentChunk.length * 0.2)
          );
          previousOverlap =
            currentChunk.length > overlapCharCount
              ? currentChunk.substring(currentChunk.length - overlapCharCount).trim()
              : '';

          // 次のチャンクを前のチャンクのオーバーラップで開始
          currentChunk = previousOverlap
            ? previousOverlap + ' ' + trimmedSentence
            : trimmedSentence;

          // オーバーラップ後もCHUNK_SIZEを超える場合の処理
          if (currentChunk.length > this.CHUNK_SIZE) {
            currentChunk = trimmedSentence; // オーバーラップを諦めて新規開始
          }
        } else {
          currentChunk = trimmedSentence;
        }
      } else {
        currentChunk = (currentChunk + ' ' + trimmedSentence).trim();
      }
    }

    // 最後のチャンクを処理
    if (currentChunk.length > 0) {
      // 最後のチャンクもオーバーフロー防止
      while (currentChunk.length > this.CHUNK_SIZE) {
        const cutPoint = currentChunk.lastIndexOf(' ', this.CHUNK_SIZE);
        const chunk =
          cutPoint > 0
            ? currentChunk.substring(0, cutPoint)
            : currentChunk.substring(0, this.CHUNK_SIZE);

        if (!seenChunks.has(chunk) && chunk.length >= this.MIN_CHUNK_SIZE) {
          chunks.push(chunk);
          seenChunks.add(chunk);
        }

        currentChunk = currentChunk.substring(cutPoint > 0 ? cutPoint + 1 : this.CHUNK_SIZE);
      }

      if (currentChunk.length >= this.MIN_CHUNK_SIZE && !seenChunks.has(currentChunk)) {
        chunks.push(currentChunk);
      }
    }

    return chunks;
  }

  /**
   * 文境界と文字数で分割するメソッド（後方互換性のため残す）
   */
  private static splitBySentencesAndSize(text: string): string[] {
    return this.splitBySentencesAndSizeWithOverlap(text);
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
   * 類似チャンクを検索（ハイブリッド検索対応）
   */
  static async searchSimilarChunks(
    templateId: string,
    queryText: string,
    limit: number = 4,
    useHybrid: boolean = true
  ): Promise<PromptChunk[]> {
    try {
      // クエリの埋め込みを生成
      const queryEmbedding = await this.generateEmbedding(queryText);

      let data, error;

      if (useHybrid) {
        // テンプレート専用ハイブリッド検索（Precision 重視）
        ({ data, error } = await supabase.rpc('search_prompt_chunks_hybrid_by_template', {
          target_template_id: templateId,
          query_text: queryText,
          query_embedding: queryEmbedding,
          match_threshold: 0.4, // 閾値を緩めてヒット率向上
          match_count: limit,
          alpha: 0.5, // semantic vs BM25 の重み
        }));
      } else {
        // 従来のベクトル検索
        ({ data, error } = await supabase.rpc('search_prompt_chunks', {
          template_id: templateId,
          query_embedding: queryEmbedding,
          similarity_threshold: 0.2, // さらに緩めてヒット率向上
          match_count: limit,
        }));
      }

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
   * 汎用的なチャンク検索（全テンプレート対象）
   */
  static async searchChunks(
    query: string,
    embedding: number[],
    limit: number = 20,
    threshold: number = 0.7,
    useHybrid: boolean = true,
    templateId: string | null = null
  ): Promise<PromptChunk[]> {
    const rpcFunction = useHybrid ? 'search_prompt_chunks_hybrid' : 'search_prompt_chunks';

    const params = useHybrid
      ? {
          query_text: query,
          query_embedding: embedding,
          target_template_id: templateId,
          match_threshold: threshold,
          match_count: limit,
          alpha: 0.5, // セマンティック検索とBM25のバランス
        }
      : {
          query_embedding: embedding,
          match_threshold: threshold,
          match_count: limit,
        };

    const { data, error } = await supabase.rpc(rpcFunction, params);

    if (error) {
      console.error('Error searching chunks:', error);
      throw new Error('Failed to search chunks');
    }

    return data || [];
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
