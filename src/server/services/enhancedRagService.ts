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
  return response.data[0]?.embedding || [];
}
import { PromptChunkService } from './promptChunkService';
import { OpenAIReranker } from '@/lib/reranker';
import { QueryExpansionService } from './queryExpansionService';

export interface CitedResponse {
  answer: string;
  sources: Array<{
    id: string;
    content: string;
    similarity: number;
    citation_number: number;
  }>;
  confidence: number;
}

export interface RAGGenerationOptions {
  useMultiQuery?: boolean;
  useCitation?: boolean;
  useVerification?: boolean;
  maxChunks?: number;
  temperature?: number;
}

interface SearchChunk {
  chunk_text: string;
  content?: string;
  score: number;
  id?: string;
}

interface PromptChunk {
  id: string;
  chunk_text: string;
  similarity?: number;
  combined_score?: number;
}

interface SearchResult {
  id: string;
  chunk_text: string;
  similarity?: number;
  combined_score?: number;
  template_id?: string;
  chunk_index?: number;
  embedding?: number[];
  updated_at?: string;
}

// interface MultiQueryResult {
//   id: string;
//   content: string;
//   score: number;
//   query_sources: number[];
//   max_score: number;
//   chunk_text: string;
// }

interface VerificationResponse {
  answer: string;
  confidence: number;
}

interface ContextItem {
  id: string;
  content: string;
  citation_number: number;
}

export class EnhancedRAGService {
  /**
   * JSON Function-Calling対応のRAG生成
   */
  static async generateWithFunctionCalling(
    query: string,
    options: RAGGenerationOptions = {}
  ): Promise<CitedResponse> {
    const {
      useMultiQuery = true,
      useVerification = false,
      maxChunks = 8,
      temperature = 0.7,
    } = options;

    try {
      // 1. 検索とリランク
      const chunks = await this.retrieveAndRerank(query, maxChunks, useMultiQuery);

      if (chunks.length === 0) {
        return {
          answer: '申し訳ございませんが、関連する情報が見つかりませんでした。',
          sources: [],
          confidence: 0,
        };
      }

      // 2. Function-Calling対応のプロンプト構築
      const context = chunks.map((chunk, index) => ({
        id: `chunk_${index + 1}`,
        content: chunk.chunk_text,
        citation_number: index + 1,
      }));

      // 3. Function-Calling用の関数定義
      const functions = [
        {
          name: 'generate_cited_response',
          description: 'コンテキストに基づいて引用付きの回答を生成します',
          parameters: {
            type: 'object',
            properties: {
              answer: {
                type: 'string',
                description: 'ユーザーの質問に対する詳細な回答',
              },
              citations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    citation_number: {
                      type: 'integer',
                      description: '引用番号',
                    },
                    quoted_text: {
                      type: 'string',
                      description: '引用したテキストの一部',
                    },
                    relevance: {
                      type: 'number',
                      description: '関連度スコア (0-1)',
                    },
                  },
                  required: ['citation_number', 'quoted_text', 'relevance'],
                },
                description: '使用した引用のリスト',
              },
              confidence: {
                type: 'number',
                description: '回答の信頼度 (0-1)',
              },
            },
            required: ['answer', 'citations', 'confidence'],
          },
        },
      ];

      // 4. システムプロンプト構築
      const systemPrompt = `あなたは業界特化型マーケティングの専門家です。提供されたコンテキストに基づいて正確な回答を生成してください。

コンテキスト:
${context.map(c => `[${c.citation_number}] ${c.content}`).join('\n\n')}

重要な指示:
- 必ず提供されたコンテキストに基づいて回答してください
- 回答には必要に応じて引用番号を含めてください
- 不明な点は素直に「分からない」と答えてください
- 引用した部分は正確に記録してください
- 回答の信頼度を客観的に評価してください`;

      // 5. Function-Calling実行
      const response = await openai.chat.completions.create({
        model: 'ad_copy_finishing', // バージョン固定で安定性向上
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        functions,
        function_call: { name: 'generate_cited_response' },
        temperature,
        max_tokens: 4000, // Function-Calling用に増量（上限内）
      });

      // 6. 結果の解析
      const functionCall = response.choices[0]?.message?.function_call;
      if (!functionCall || !functionCall.arguments) {
        throw new Error('Function call failed');
      }

      const result = JSON.parse(functionCall.arguments);

      // 7. Self-Verification（オプション）
      if (useVerification) {
        const verifiedResult = await this.verifyResponse(query, result, context);
        return {
          answer: verifiedResult.answer,
          sources: context.map(c => ({
            id: c.id,
            content: c.content,
            similarity: 0.8, // デフォルト値
            citation_number: c.citation_number,
          })),
          confidence: verifiedResult.confidence,
        };
      }

      return {
        answer: result.answer,
        sources: context.map(c => ({
          id: c.id,
          content: c.content,
          similarity: 0.8, // デフォルト値
          citation_number: c.citation_number,
        })),
        confidence: result.confidence,
      };
    } catch (error) {
      console.error('Enhanced RAG生成エラー:', error);
      throw new Error('RAG生成に失敗しました');
    }
  }

  /**
   * 検索とリランクの実行
   */
  private static async retrieveAndRerank(
    query: string,
    maxChunks: number,
    useMultiQuery: boolean = true
  ): Promise<SearchChunk[]> {
    const embedding = await openaiEmbed(query);

    if (useMultiQuery) {
      // マルチクエリ検索
      const expandedQueries = await QueryExpansionService.generateRelatedQueries(query, 2);
      const searchFunction = async (
        searchQuery: string,
        embedding: number[]
      ): Promise<PromptChunk[]> => {
        const results = (await PromptChunkService.searchChunks(
          searchQuery,
          embedding,
          50, // 多めに取得
          0.78,
          true // ハイブリッド検索
        )) as SearchResult[];
        // PromptChunkServiceの結果をPromptChunk型に変換
        return results.map(result => ({
          id: result.id || '',
          chunk_text: result.chunk_text,
          ...(result.similarity !== undefined && { similarity: result.similarity }),
          ...(result.combined_score !== undefined && { combined_score: result.combined_score }),
        }));
      };

      const chunks = await QueryExpansionService.performMultiQuerySearch(
        query,
        expandedQueries,
        searchFunction
      );

      // リランク
      const reranker = new OpenAIReranker();
      const chunkTexts = chunks.map(chunk => chunk.content);
      const rerankedResults = await reranker.rerank(query, chunkTexts, { topK: maxChunks });

      return rerankedResults.map(
        (result): SearchChunk => ({
          chunk_text: result.document,
          content: result.document,
          score: result.score,
        })
      );
    } else {
      // 通常検索
      const chunks = (await PromptChunkService.searchChunks(
        query,
        embedding,
        50,
        0.78,
        true
      )) as SearchResult[];

      const reranker = new OpenAIReranker();
      const chunkTexts = chunks.map(chunk => chunk.chunk_text);
      const rerankedResults = await reranker.rerank(query, chunkTexts, { topK: maxChunks });

      return rerankedResults.map(
        (result): SearchChunk => ({
          chunk_text: result.document,
          content: result.document,
          score: result.score,
        })
      );
    }
  }

  /**
   * Self-Verification機能
   */
  private static async verifyResponse(
    originalQuery: string,
    response: VerificationResponse,
    context: ContextItem[]
  ): Promise<VerificationResponse> {
    const verificationPrompt = `以下の回答を検証してください：

元の質問: ${originalQuery}

回答: ${response.answer}

コンテキスト:
${context.map(c => `[${c.citation_number}] ${c.content}`).join('\n\n')}

検証観点:
1. 回答がコンテキストに基づいているか
2. 引用が正確か
3. 事実に基づかない内容が含まれていないか
4. 回答の信頼度は適切か

以下のJSON形式で回答してください：
{
  "answer": "修正された回答またはそのままの回答",
  "confidence": 0.85
}`;

    const verificationResponse = await openai.chat.completions.create({
      model: 'ad_copy_finishing',
      messages: [{ role: 'user', content: verificationPrompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 2000, // 検証結果用に適切なサイズ
    });

    try {
      const rawVerification = JSON.parse(
        verificationResponse.choices[0]?.message?.content || '{}'
      ) as Partial<VerificationResponse>;
      return {
        answer: rawVerification.answer || response.answer,
        confidence: rawVerification.confidence || response.confidence * 0.9, // 検証通過で若干減点
      };
    } catch (error) {
      console.error('検証結果の解析エラー:', error);
      return response;
    }
  }

  /**
   * 簡単な引用付き回答生成（Function-Calling不要な場合）
   */
  static async generateWithSimpleCitation(query: string, maxChunks: number = 8): Promise<string> {
    try {
      const chunks = await this.retrieveAndRerank(query, maxChunks, true);

      if (chunks.length === 0) {
        return '申し訳ございませんが、関連する情報が見つかりませんでした。';
      }

      const context = chunks
        .map((chunk, index) => `[${index + 1}] ${chunk.chunk_text}`)
        .join('\n\n');

      const response = await openai.chat.completions.create({
        model: 'ad_copy_finishing', // バージョン固定
        messages: [
          {
            role: 'system',
            content: `あなたは業界特化型マーケティングの専門家です。以下のコンテキストに基づいて、引用付きで回答してください。

コンテキスト:
${context}

重要な指示:
- 必ず提供されたコンテキストに基づいて回答してください
- 参考にした部分は {{cite:X}} の形式で引用してください（Xは番号）
- 不明な点は素直に「分からない」と答えてください
- 日本語で回答してください`,
          },
          { role: 'user', content: query },
        ],
        temperature: 0.7,
        max_tokens: 3000, // 引用付き回答用に適切なサイズ
      });

      return response.choices[0]?.message?.content || '回答を生成できませんでした。';
    } catch (error) {
      console.error('Simple Citation RAG生成エラー:', error);
      throw new Error('RAG生成に失敗しました');
    }
  }
}
