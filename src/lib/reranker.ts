import OpenAI from 'openai';
import { env } from '@/env';

export interface RerankResult {
  document: string;
  score: number;
  originalIndex: number;
}

export interface RerankOptions {
  topK?: number;
  temperature?: number;
  model?: string;
}

/**
 * OpenAI APIを使用したリランキング機能
 * Claude品質に近づけるため、高精度な文書再順位付けを実現
 */
export class OpenAIReranker {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  /**
   * 文書をクエリとの関連度でリランク
   */
  async rerank(
    query: string,
    documents: string[],
    options: RerankOptions = {}
  ): Promise<RerankResult[]> {
    const { topK = 5, temperature = 0.1, model = 'ad_copy_finishing' } = options;

    if (documents.length === 0) {
      return [];
    }

    try {
      const prompt = this.buildRerankPrompt(query, documents);

      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `あなたは文書の関連度評価専門家です。
            与えられたクエリに対して、文書の関連度を0.0〜1.0で評価してください。
            
            評価基準：
            - 1.0: 直接的に関連し、完全に回答
            - 0.8-0.9: 高度に関連し、ほぼ回答
            - 0.6-0.7: 関連性があり、部分的に回答
            - 0.4-0.5: 弱い関連性
            - 0.0-0.3: 無関係または関連性が薄い
            
            JSONで結果を返してください。`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('リランク結果が空です');
      }

      const scores = JSON.parse(result) as {
        scores: Array<{ document_id: number; score: number; reasoning: string }>;
      };
      const rerankedResults = this.parseAndSort(documents, scores, topK);

      return rerankedResults;
    } catch (error) {
      console.error('リランクエラー:', error);
      // フォールバック: 元の順序を保持
      return documents.slice(0, topK).map((doc, index) => ({
        document: doc,
        score: 0.5, // 中間値
        originalIndex: index,
      }));
    }
  }

  /**
   * リランク用プロンプトを構築
   */
  private buildRerankPrompt(query: string, documents: string[]): string {
    const docList = documents.map((doc, i) => `文書${i + 1}: ${doc}`).join('\n');

    return `
## クエリ
${query}

## 文書一覧
${docList}

## 評価指示
上記の文書を、クエリとの関連度で0.0〜1.0のスコアで評価してください。

## 出力形式
{
  "scores": [
    {"document_id": 1, "score": 0.9, "reasoning": "評価理由"},
    {"document_id": 2, "score": 0.7, "reasoning": "評価理由"},
    ...
  ]
}

前置きは不要です。JSONのみ出力してください。
`;
  }

  /**
   * 結果をパースして並び替え
   */
  private parseAndSort(
    documents: string[],
    scores: { scores: Array<{ document_id: number; score: number; reasoning: string }> },
    topK: number
  ): RerankResult[] {
    try {
      if (!scores.scores || !Array.isArray(scores.scores)) {
        throw new Error('スコア配列が見つかりません');
      }

      const results: RerankResult[] = scores.scores
        .map((item: { document_id: number; score: number; reasoning: string }) => {
          const docIndex = (item.document_id || 1) - 1; // 1-based to 0-based
          const document = documents[docIndex];
          if (docIndex >= 0 && docIndex < documents.length && document) {
            return {
              document,
              score: Math.max(0, Math.min(1, item.score || 0)),
              originalIndex: docIndex,
            };
          }
          return null;
        })
        .filter((item): item is RerankResult => item !== null)
        .sort((a, b) => b.score - a.score) // 降順でソート
        .slice(0, topK);

      return results;
    } catch (error) {
      console.error('結果パースエラー:', error);
      // フォールバック
      return documents.slice(0, topK).map((doc, index) => ({
        document: doc,
        score: 0.5,
        originalIndex: index,
      }));
    }
  }
}
