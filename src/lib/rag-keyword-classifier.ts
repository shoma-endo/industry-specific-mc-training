import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import type {
  ClassifyKeywordsResponse,
  ClassificationOptions,
  KeywordResult,
  Evidence,
  SearchResultByKeyword,
  HybridSearchResult,
} from '@/types/rag';
import {
  RAGClassificationError,
  EmbeddingGenerationError,
  DatabaseError,
  ClassificationError,
} from '@/types/rag';

/**
 * RAGベースキーワード分類システム
 * 
 * ファインチューニングモデルからRAGシステムに移行し、
 * より柔軟で保守性の高いキーワード分類を実現
 */
export class RAGKeywordClassifier {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!
  );
  
  private openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });

  /**
   * キーワード配列を分類
   */
  async classifyKeywords(
    keywords: string[],
    options: ClassificationOptions = {}
  ): Promise<ClassifyKeywordsResponse> {
    const startTime = Date.now();
    
    try {
      // 1. 入力検証・正規化
      const normalizedKeywords = this.normalizeKeywords(keywords);
      
      if (normalizedKeywords.length === 0) {
        throw new ClassificationError('有効なキーワードがありません');
      }

      // 2. 各キーワードの類似事例検索
      const searchResults = await this.searchSimilarExamples(normalizedKeywords);
      
      // 3. LLMによる分類実行
      const classificationResult = await this.performClassification(
        normalizedKeywords,
        searchResults
      );
      
      // 4. 結果の構造化
      const structuredResults = this.structureResults(
        normalizedKeywords,
        classificationResult,
        searchResults
      );
      
      // 5. エビデンス生成（オプション）
      const evidence = options.includeEvidence 
        ? this.generateEvidence(searchResults)
        : undefined;

      const response: ClassifyKeywordsResponse = {
        results: structuredResults,
        metadata: {
          totalProcessed: keywords.length,
          processingTime: Date.now() - startTime,
          confidence: this.calculateOverallConfidence(structuredResults)
        }
      };

      if (evidence !== undefined) {
        response.evidence = evidence;
      }

      return response;

    } catch (error) {
      if (error instanceof RAGClassificationError) {
        throw error;
      }
      throw new ClassificationError(
        'キーワード分類中にエラーが発生しました',
        { originalError: error }
      );
    }
  }

  /**
   * キーワードの正規化処理
   */
  private normalizeKeywords(keywords: string[]): string[] {
    return keywords
      .map(keyword => keyword.trim())
      .filter(keyword => keyword.length > 0)
      .slice(0, 20); // 最大20キーワードに制限
  }

  /**
   * 各キーワードの類似事例を検索
   */
  private async searchSimilarExamples(keywords: string[]): Promise<SearchResultByKeyword[]> {
    try {
      const results = await Promise.all(
        keywords.map(async (keyword) => {
          // embedding生成
          const embedding = await this.generateEmbedding(keyword);
          
          // ハイブリッド検索実行
          const { data, error } = await this.supabase
            .rpc('hybrid_keyword_search', {
              search_text: keyword,
              query_embedding: embedding,
              result_limit: 5
            });

          if (error) {
            console.error(`検索エラー (${keyword}):`, error);
            return {
              keyword,
              similarExamples: []
            };
          }

          return {
            keyword,
            similarExamples: data || []
          };
        })
      );

      return results;

    } catch (error) {
      throw new DatabaseError('類似事例検索中にエラーが発生しました', { error });
    }
  }

  /**
   * LLMによる分類実行
   */
  private async performClassification(
    keywords: string[],
    searchResults: SearchResultByKeyword[]
  ): Promise<string> {
    try {
      // 類似事例からコンテキスト構築
      const context = this.buildContext(searchResults);
      
      // プロンプト構築
      const prompt = this.buildClassificationPrompt(keywords, context);
      
      // OpenAI API呼び出し
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini-2024-07-18',
        messages: [
          {
            role: 'system',
            content: `あなたはGoogle広告のキーワード分類の専門家です。
            提供されたコンテキストを参考に、キーワードを「今すぐ客キーワード」または「後から客キーワード」に分類してください。
            
            類似事例の分類傾向を重視し、一貫性のある分類を行ってください。`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 1000
      });

      return response.choices[0]?.message?.content || '';

    } catch (error) {
      throw new ClassificationError('LLM分類処理中にエラーが発生しました', { error });
    }
  }

  /**
   * 類似事例からコンテキストを構築
   */
  private buildContext(searchResults: SearchResultByKeyword[]): string {
    const contextParts: string[] = [];
    
    searchResults.forEach(result => {
      if (result.similarExamples.length > 0) {
        contextParts.push(`\n${result.keyword}の類似事例:`);
        result.similarExamples.forEach((example: HybridSearchResult) => {
          const classification = example.classification === 'immediate' ? '今すぐ客' : '後から客';
          contextParts.push(
            `  - ${example.keyword} → ${classification} (類似度: ${example.combined_score.toFixed(2)})`
          );
        });
      }
    });
    
    return contextParts.join('\n');
  }

  /**
   * 分類プロンプトの構築
   */
  private buildClassificationPrompt(keywords: string[], context: string): string {
    return `
## 分類ルール
- 今すぐ客キーワード: 商品・サービスの利用を具体的に検討し、すぐに行動を起こす可能性が高い
  - 具体的なサービス + 地域名
  - "依頼"、"申込"、"予約"などの行動意図
  - "格安"、"即日"などの緊急性・価格志向
  
- 後から客キーワード: 情報収集・比較検討段階で、即座の行動には繋がりにくい
  - 一般的な情報収集
  - "とは"、"方法"、"比較"などの教育的内容
  - 業界全般の情報

## 参考事例
${context}

## 分類対象キーワード
${keywords.map((k, i) => `${i + 1}. ${k}`).join('\n')}

## 出力形式
【今すぐ客キーワード】
（該当するキーワードを列挙）

【後から客キーワード】
（該当するキーワードを列挙）

前置きは不要です。上記の形式で出力してください。
`;
  }

  /**
   * 分類結果の構造化
   */
  private structureResults(
    keywords: string[],
    classificationResult: string,
    searchResults: SearchResultByKeyword[]
  ) {
    const immediate = this.extractKeywords(classificationResult, '今すぐ客キーワード');
    const later = this.extractKeywords(classificationResult, '後から客キーワード');
    const unclassified = keywords.filter(k => 
      !immediate.includes(k) && !later.includes(k)
    );

    return {
      immediate_customer: immediate.map(k => this.createKeywordResult(k, 'immediate', searchResults)),
      later_customer: later.map(k => this.createKeywordResult(k, 'later', searchResults)),
      unclassified: unclassified.map(k => this.createKeywordResult(k, 'unclassified', searchResults))
    };
  }

  /**
   * 分類結果からキーワードを抽出
   */
  private extractKeywords(text: string, category: string): string[] {
    const regex = new RegExp(`【${category}】([\\s\\S]*?)(?=【|$)`);
    const match = text.match(regex);
    
    if (!match || !match[1]) return [];
    
    return match[1]
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.replace(/^\d+\.\s*/, '')); // 番号を除去
  }

  /**
   * KeywordResult オブジェクトの作成
   */
  private createKeywordResult(
    keyword: string,
    classification: 'immediate' | 'later' | 'unclassified',
    searchResults: SearchResultByKeyword[]
  ): KeywordResult {
    const searchResult = searchResults.find(r => r.keyword === keyword);
    const confidence = this.calculateConfidence(classification, searchResult);
    
    return {
      keyword,
      classification,
      confidence,
      similarKeywords: searchResult?.similarExamples
        .slice(0, 3)
        .map((ex: HybridSearchResult) => ex.keyword) || []
    };
  }

  /**
   * 信頼度の計算
   */
  private calculateConfidence(
    classification: string,
    searchResult: SearchResultByKeyword | undefined
  ): number {
    if (!searchResult || searchResult.similarExamples.length === 0) {
      return 0.5; // 低信頼度
    }

    const topSimilarity = searchResult.similarExamples[0]?.combined_score || 0;
    const consistentClassifications = searchResult.similarExamples
      .filter((ex: HybridSearchResult) => ex.classification === classification).length;
    
    const consistencyRatio = consistentClassifications / searchResult.similarExamples.length;
    
    return Math.min(0.95, topSimilarity * 0.6 + consistencyRatio * 0.4);
  }

  /**
   * エビデンスの生成
   */
  private generateEvidence(searchResults: SearchResultByKeyword[]): Evidence[] {
    return searchResults.map(result => ({
      keyword: result.keyword,
      similarExamples: result.similarExamples.map((ex: HybridSearchResult) => ({
        keyword: ex.keyword,
        classification: ex.classification === 'immediate' ? '今すぐ客' : '後から客',
        similarity: ex.combined_score
      }))
    }));
  }

  /**
   * 全体的な信頼度の計算
   */
  private calculateOverallConfidence(results: {
    immediate_customer: KeywordResult[];
    later_customer: KeywordResult[];
    unclassified: KeywordResult[];
  }): number {
    const allResults = [
      ...results.immediate_customer,
      ...results.later_customer,
      ...results.unclassified
    ];
    
    if (allResults.length === 0) return 0;
    
    const averageConfidence = allResults.reduce(
      (sum: number, result: KeywordResult) => sum + result.confidence, 0
    ) / allResults.length;
    
    return Math.round(averageConfidence * 100) / 100;
  }

  /**
   * OpenAI Embedding生成
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        dimensions: 1536
      });
      
      return response.data[0]?.embedding || [];

    } catch (error) {
      throw new EmbeddingGenerationError('Embedding生成中にエラーが発生しました', { error });
    }
  }
}