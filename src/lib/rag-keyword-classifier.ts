import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import crypto from 'crypto';
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
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE || ''
  );
  
  private openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
  });

  // メモリキャッシュ（本番環境ではRedisを推奨）
  private static embeddingCache = new Map<string, { embedding: number[], timestamp: number }>();
  private static readonly CACHE_TTL = 60 * 60 * 1000; // 1時間
  
  // パフォーマンスメトリクス
  private static performanceMetrics = {
    totalRequests: 0,
    embeddingApiCalls: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageResponseTime: 0,
    errorCount: 0,
    lastResetTime: Date.now()
  };

  /**
   * キーワード配列を分類
   */
  async classifyKeywords(
    keywords: string[],
    options: ClassificationOptions = {}
  ): Promise<ClassifyKeywordsResponse> {
    const startTime = Date.now();
    
    try {
      // パフォーマンスメトリクス更新
      RAGKeywordClassifier.performanceMetrics.totalRequests++;
      
      // 1. 入力検証・正規化
      const normalizedKeywords = this.normalizeKeywords(keywords);
      
      if (normalizedKeywords.length === 0) {
        throw new ClassificationError('有効なキーワードがありません');
      }

      // 2. 各キーワードの類似事例検索
      const searchResults = await this.searchSimilarExamples(normalizedKeywords, options);
      
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

      const processingTime = Date.now() - startTime;
      
      // 平均応答時間の更新
      this.updateAverageResponseTime(processingTime);

      const baseMetadata = {
        totalProcessed: keywords.length,
        processingTime,
        confidence: this.calculateOverallConfidence(structuredResults)
      };

      // パフォーマンス情報を含める（開発環境のみ）
      const metadata = process.env.NODE_ENV === 'development' 
        ? { ...baseMetadata, performance: this.getPerformanceSnapshot() }
        : baseMetadata;

      const response: ClassifyKeywordsResponse = {
        results: structuredResults,
        metadata
      };

      if (evidence !== undefined) {
        response.evidence = evidence;
      }

      return response;

    } catch (error) {
      // エラー数をカウント
      RAGKeywordClassifier.performanceMetrics.errorCount++;
      
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
  private async searchSimilarExamples(
    keywords: string[], 
    options: ClassificationOptions = {}
  ): Promise<SearchResultByKeyword[]> {
    try {
      // バッチでEmbedding生成（コスト削減）
      const embeddings = await this.generateEmbeddingsBatch(keywords);
      
      // 検索パラメータの動的調整
      const searchParams = this.adjustSearchParameters(keywords);
      
      // 並列でハイブリッド検索実行
      const results = await Promise.all(
        keywords.map(async (keyword, index) => {
          const embedding = embeddings[index];
          
          // コンテキストを考慮した検索関数選択
          const searchFunction = this.selectSearchFunction(keyword, options);
          
          const { data, error } = await this.supabase
            .rpc(searchFunction, {
              search_text: keyword,
              query_embedding: embedding,
              context_type: searchParams.contextType,
              vector_weight: searchParams.vectorWeight,
              text_weight: searchParams.textWeight,
              similarity_threshold: searchParams.similarityThreshold,
              result_limit: searchParams.resultLimit
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
   * 検索パラメータの動的調整
   */
  private adjustSearchParameters(keywords: string[]) {
    const avgLength = keywords.reduce((sum, k) => sum + k.length, 0) / keywords.length;
    const hasLocationKeywords = keywords.some(k => this.isLocationKeyword(k));
    const hasServiceKeywords = keywords.some(k => this.isServiceKeyword(k));
    
    return {
      contextType: hasLocationKeywords ? 'local' : hasServiceKeywords ? 'service' : 'general',
      vectorWeight: avgLength > 15 ? 0.6 : 0.7, // 長いキーワードはテキスト検索重視
      textWeight: avgLength > 15 ? 0.4 : 0.3,
      similarityThreshold: keywords.length > 10 ? 0.6 : 0.5, // 多数キーワードは閾値を上げる
      resultLimit: Math.max(3, Math.min(8, Math.floor(keywords.length / 2))) // 適応的な結果数
    };
  }

  /**
   * 検索関数の選択
   */
  private selectSearchFunction(_keyword: string, options: ClassificationOptions): string {
    if (options.includeDiversity) {
      return 'diversity_rerank_search';
    }
    
    if (options.userContext) {
      return 'contextual_keyword_search';
    }
    
    return 'advanced_hybrid_search';
  }

  /**
   * 地域キーワードの判定
   */
  private isLocationKeyword(keyword: string): boolean {
    const locationPatterns = [
      /[都道府県市区町村]/,
      /東京|大阪|名古屋|福岡|札幌|仙台|広島|神戸|京都|横浜/,
      /[0-9]{3}-[0-9]{4}/, // 郵便番号
      /駅|空港|港/
    ];
    
    return locationPatterns.some(pattern => pattern.test(keyword));
  }

  /**
   * サービスキーワードの判定
   */
  private isServiceKeyword(keyword: string): boolean {
    const servicePatterns = [
      /サービス|支援|相談|代行|作成|制作|設計|開発|運営|管理/,
      /料金|価格|費用|コスト|見積|無料|格安/,
      /予約|申込|依頼|注文|購入|契約/
    ];
    
    return servicePatterns.some(pattern => pattern.test(keyword));
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

    // リランキング処理
    const immediateResults = immediate.map(k => this.createKeywordResult(k, 'immediate', searchResults));
    const laterResults = later.map(k => this.createKeywordResult(k, 'later', searchResults));
    const unclassifiedResults = unclassified.map(k => this.createKeywordResult(k, 'unclassified', searchResults));

    return {
      immediate_customer: this.rerankResults(immediateResults, 'immediate'),
      later_customer: this.rerankResults(laterResults, 'later'),
      unclassified: this.rerankResults(unclassifiedResults, 'unclassified')
    };
  }

  /**
   * 結果のリランキング
   */
  private rerankResults(results: KeywordResult[], category: string): KeywordResult[] {
    return results.sort((a, b) => {
      // 1. 信頼度でソート
      const confidenceDiff = b.confidence - a.confidence;
      if (Math.abs(confidenceDiff) > 0.1) {
        return confidenceDiff;
      }
      
      // 2. 類似キーワード数でソート
      const similarityDiff = (b.similarKeywords?.length || 0) - (a.similarKeywords?.length || 0);
      if (similarityDiff !== 0) {
        return similarityDiff;
      }
      
      // 3. カテゴリ特有の重み付け
      const categoryWeight = this.calculateCategoryWeight(a.keyword, b.keyword, category);
      if (categoryWeight !== 0) {
        return categoryWeight;
      }
      
      // 4. キーワード長（短い方が優先）
      return a.keyword.length - b.keyword.length;
    });
  }

  /**
   * カテゴリ特有の重み付け計算
   */
  private calculateCategoryWeight(keywordA: string, keywordB: string, category: string): number {
    if (category === 'immediate') {
      // 今すぐ客キーワードは地域名や具体的サービス名を優先
      const aHasLocation = this.isLocationKeyword(keywordA);
      const bHasLocation = this.isLocationKeyword(keywordB);
      
      if (aHasLocation && !bHasLocation) return -1;
      if (!aHasLocation && bHasLocation) return 1;
      
      const aHasService = this.isServiceKeyword(keywordA);
      const bHasService = this.isServiceKeyword(keywordB);
      
      if (aHasService && !bHasService) return -1;
      if (!aHasService && bHasService) return 1;
    } else if (category === 'later') {
      // 後から客キーワードは一般的な情報キーワードを優先
      const aIsGeneral = this.isGeneralKeyword(keywordA);
      const bIsGeneral = this.isGeneralKeyword(keywordB);
      
      if (aIsGeneral && !bIsGeneral) return -1;
      if (!aIsGeneral && bIsGeneral) return 1;
    }
    
    return 0;
  }

  /**
   * 一般的なキーワードの判定
   */
  private isGeneralKeyword(keyword: string): boolean {
    const generalPatterns = [
      /とは|方法|やり方|手順|流れ|仕組み/,
      /比較|違い|選び方|おすすめ|ランキング/,
      /メリット|デメリット|効果|特徴|基本/,
      /種類|一覧|まとめ|解説|説明/
    ];
    
    return generalPatterns.some(pattern => pattern.test(keyword));
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
   * OpenAI Embedding生成（バッチ処理）
   */
  private async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    try {
      const results: number[][] = [];
      const uncachedTexts: string[] = [];
      const uncachedIndexes: number[] = [];

      // キャッシュから取得できるものを先に処理
      for (let i = 0; i < texts.length; i++) {
        const text = texts[i];
        if (text) {
          const cached = this.getCachedEmbedding(text);
          if (cached) {
            results[i] = cached;
          } else {
            uncachedTexts.push(text);
            uncachedIndexes.push(i);
          }
        }
      }

      // キャッシュにないものだけAPI呼び出し
      if (uncachedTexts.length > 0) {
        RAGKeywordClassifier.performanceMetrics.embeddingApiCalls++;
        
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-3-large',  // Claudeに近い高性能モデル
          input: uncachedTexts,
          dimensions: 3072,                 // 最大次元数
        });

        // 結果をキャッシュに保存＆結果配列に設定
        response.data.forEach((item, index) => {
          const embedding = item.embedding;
          const originalIndex = uncachedIndexes[index];
          const text = uncachedTexts[index];
          
          if (text && originalIndex !== undefined) {
            this.setCachedEmbedding(text, embedding);
            results[originalIndex] = embedding;
          }
        });
      }

      return results;

    } catch (error) {
      throw new EmbeddingGenerationError('Embedding生成中にエラーが発生しました', { error });
    }
  }

  /**
   * OpenAI Embedding生成（単一テキスト）
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      // キャッシュから取得を試行
      const cached = this.getCachedEmbedding(text);
      if (cached) {
        return cached;
      }

      RAGKeywordClassifier.performanceMetrics.embeddingApiCalls++;
      
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-large',  // Claudeに近い高性能モデル
        input: text,
        dimensions: 3072,                 // 最大次元数
      });
      
      const embedding = response.data[0]?.embedding || [];
      
      // キャッシュに保存
      if (embedding.length > 0) {
        this.setCachedEmbedding(text, embedding);
      }
      
      return embedding;

    } catch (error) {
      throw new EmbeddingGenerationError('Embedding生成中にエラーが発生しました', { error });
    }
  }

  /**
   * キャッシュからEmbeddingを取得
   */
  private getCachedEmbedding(text: string): number[] | null {
    const cacheKey = this.generateCacheKey(text);
    const cached = RAGKeywordClassifier.embeddingCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < RAGKeywordClassifier.CACHE_TTL) {
      // キャッシュヒット
      RAGKeywordClassifier.performanceMetrics.cacheHits++;
      return cached.embedding;
    }
    
    // キャッシュミス
    RAGKeywordClassifier.performanceMetrics.cacheMisses++;
    
    // 期限切れの場合は削除
    if (cached) {
      RAGKeywordClassifier.embeddingCache.delete(cacheKey);
    }
    
    return null;
  }

  /**
   * Embeddingをキャッシュに保存
   */
  private setCachedEmbedding(text: string, embedding: number[]): void {
    const cacheKey = this.generateCacheKey(text);
    RAGKeywordClassifier.embeddingCache.set(cacheKey, {
      embedding,
      timestamp: Date.now()
    });

    // キャッシュサイズ制限（1000件）
    if (RAGKeywordClassifier.embeddingCache.size > 1000) {
      const oldestKey = RAGKeywordClassifier.embeddingCache.keys().next().value;
      if (oldestKey) {
        RAGKeywordClassifier.embeddingCache.delete(oldestKey);
      }
    }
  }

  /**
   * キャッシュキーの生成
   */
  private generateCacheKey(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  /**
   * 平均応答時間の更新
   */
  private updateAverageResponseTime(responseTime: number): void {
    const metrics = RAGKeywordClassifier.performanceMetrics;
    const totalRequests = metrics.totalRequests;
    
    metrics.averageResponseTime = 
      (metrics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
  }

  /**
   * パフォーマンススナップショットの取得
   */
  private getPerformanceSnapshot() {
    const metrics = RAGKeywordClassifier.performanceMetrics;
    const uptime = Date.now() - metrics.lastResetTime;
    
    return {
      totalRequests: metrics.totalRequests,
      embeddingApiCalls: metrics.embeddingApiCalls,
      cacheHitRate: metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses) || 0,
      averageResponseTime: Math.round(metrics.averageResponseTime),
      errorRate: metrics.errorCount / metrics.totalRequests || 0,
      uptimeMs: uptime,
      cacheSize: RAGKeywordClassifier.embeddingCache.size
    };
  }

  /**
   * パフォーマンスメトリクスのリセット
   */
  static resetPerformanceMetrics(): void {
    RAGKeywordClassifier.performanceMetrics = {
      totalRequests: 0,
      embeddingApiCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      errorCount: 0,
      lastResetTime: Date.now()
    };
  }

  /**
   * パフォーマンスメトリクスの取得（公開メソッド）
   */
  static getPerformanceMetrics() {
    const metrics = RAGKeywordClassifier.performanceMetrics;
    const uptime = Date.now() - metrics.lastResetTime;
    
    return {
      totalRequests: metrics.totalRequests,
      embeddingApiCalls: metrics.embeddingApiCalls,
      cacheHitRate: metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses) || 0,
      averageResponseTime: Math.round(metrics.averageResponseTime),
      errorRate: metrics.errorCount / metrics.totalRequests || 0,
      uptimeMs: uptime,
      cacheSize: RAGKeywordClassifier.embeddingCache.size,
      memoryUsage: process.memoryUsage()
    };
  }
}