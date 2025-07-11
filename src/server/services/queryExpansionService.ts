import OpenAI from 'openai';
import { env } from '@/env';

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

async function openaiEmbed(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: 1536,
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding || embedding.length === 0) {
    console.error('Empty embedding received for text:', text.substring(0, 100));
    throw new Error('Empty embedding received from OpenAI API');
  }

  return embedding;
}

interface PromptChunk {
  id: string;
  chunk_text: string;
  similarity?: number;
  combined_score?: number;
}

interface MultiQueryResult {
  id: string;
  content: string;
  score: number;
  query_sources: number[];
  max_score: number;
}

export class QueryExpansionService {
  /**
   * 元のクエリから関連クエリを生成
   */
  static async generateRelatedQueries(originalQuery: string, count: number = 2): Promise<string[]> {
    const prompt = `以下のクエリに関連する類義語や言い換えを${count}個生成してください。
元のクエリ: "${originalQuery}"

要求：
- 同じ意味を持つが異なる表現を使用
- 専門用語がある場合は一般的な表現も含める
- 元のクエリより具体的または抽象的なバリエーションを含める

回答形式：
1. 関連クエリ1
2. 関連クエリ2`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    // 番号付きリストから抽出（改善版）
    const queries = content
      .split('\n')
      .map((line: string) => {
        // 数字. で始まる行からクエリを抽出
        const match = line.match(/^\d+\.\s*(.+)$/);
        return match && match[1] ? match[1].trim() : '';
      })
      .filter((query: string) => query.length > 0 && query.length < 200); // 長すぎるクエリを除外

    return queries.slice(0, count);
  }

  /**
   * 複数のクエリの埋め込みを生成し、マージ
   */
  static async generateMultiQueryEmbeddings(queries: string[]): Promise<{
    embeddings: number[][];
    mergedEmbedding: number[];
  }> {
    const embeddings = await Promise.all(queries.map((query: string) => openaiEmbed(query)));

    // 平均ベクトルを計算
    const mergedEmbedding =
      embeddings[0]?.map((_: number, index: number) => {
        const sum = embeddings.reduce((acc: number, emb: number[]) => acc + (emb[index] || 0), 0);
        return sum / embeddings.length;
      }) || [];

    return {
      embeddings,
      mergedEmbedding,
    };
  }

  /**
   * マルチクエリ検索の実行
   */
  static async performMultiQuerySearch(
    originalQuery: string,
    expandedQueries: string[],
    searchFunction: (query: string, embedding: number[]) => Promise<PromptChunk[]>
  ): Promise<MultiQueryResult[]> {
    const allQueries = [originalQuery, ...expandedQueries];
    const { embeddings } = await this.generateMultiQueryEmbeddings(allQueries);

    // 各クエリで検索実行
    const searchResults = await Promise.all(
      allQueries.map((query: string, index: number) =>
        searchFunction(query, embeddings[index] || [])
      )
    );

    // 結果をマージし、重複を除去
    const mergedResults = new Map();

    searchResults.forEach((results, queryIndex) => {
      results.forEach(result => {
        const key = result.id;
        if (!mergedResults.has(key)) {
          mergedResults.set(key, {
            id: result.id,
            content: result.chunk_text,
            score: result.combined_score || result.similarity || 0,
            query_sources: [queryIndex],
            max_score: result.combined_score || result.similarity || 0,
          });
        } else {
          const existing = mergedResults.get(key)!;
          existing.query_sources.push(queryIndex);
          existing.max_score = Math.max(
            existing.max_score,
            result.combined_score || result.similarity || 0
          );
        }
      });
    });

    // スコアと出現回数でソート
    return Array.from(mergedResults.values()).sort((a, b) => {
      // より多くのクエリで見つかったものを優先
      if (a.query_sources.length !== b.query_sources.length) {
        return b.query_sources.length - a.query_sources.length;
      }
      // 同じ出現回数の場合は最高スコアで比較
      return b.max_score - a.max_score;
    });
  }
}
