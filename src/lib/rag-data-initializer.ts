import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import type {
  FineTuningDataRow,
  ProcessedFineTuningData,
  RAGTrainingData,
  RAGIndividualKeyword,
} from '@/types/rag';
import {
  DatabaseError,
  EmbeddingGenerationError,
} from '@/types/rag';

/**
 * RAGデータ初期化クラス
 * 
 * ファインチューニングデータをRAG用データベースに変換・保存
 */
export class RAGDataInitializer {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!
  );
  
  private openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });

  private processedData: ProcessedFineTuningData[] = [];

  /**
   * CSVファイルからファインチューニングデータを読み込み
   */
  async loadFineTuningData(csvPath: string): Promise<void> {
    try {
      console.log(`CSVファイルを読み込み中: ${csvPath}`);
      
      if (!fs.existsSync(csvPath)) {
        throw new Error(`CSVファイルが見つかりません: ${csvPath}`);
      }

      const fileContent = fs.readFileSync(csvPath, 'utf8');
      const records: FineTuningDataRow[] = parse(fileContent, { 
        columns: true, 
        skip_empty_lines: true 
      });

      console.log(`${records.length}件のレコードを読み込みました`);

      // データの処理と正規化
      this.processedData = records
        .map(record => this.processFineTuningRecord(record))
        .filter(data => data !== null) as ProcessedFineTuningData[];

      console.log(`${this.processedData.length}件のデータを処理しました`);

    } catch (error) {
      throw new DatabaseError('ファインチューニングデータの読み込み中にエラーが発生しました', { error });
    }
  }

  /**
   * ファインチューニングレコードの処理
   */
  private processFineTuningRecord(record: FineTuningDataRow): ProcessedFineTuningData | null {
    try {
      // ✅ 修正：assistantから分類結果を取得
      if (!record.user || !record.assistant) {
        console.warn('必要なフィールドが不足しています:', record);
        return null;
      }

      // キーワードの抽出
      const keywords = this.extractKeywords(record.user);
      if (keywords.length === 0) {
        console.warn('キーワードが抽出できませんでした:', record.user);
        return null;
      }

      // ✅ 修正：assistantレスポンスから分類結果を解析
      const classification = this.parseClassificationResult(record.assistant);
      
      return {
        keywords,
        classification,
        raw_input: record.user,
        raw_output: record.assistant  // ✅ 修正：assistantを保存
      };

    } catch (error) {
      console.error('レコード処理エラー:', error, record);
      return null;
    }
  }

  /**
   * ユーザー入力からキーワードを抽出
   */
  private extractKeywords(userInput: string): string[] {
    // 複数の形式に対応
    const patterns = [
      /キーワード[:：]\s*(.+)/i,
      /対象キーワード[:：]\s*(.+)/i,
      /分類対象[:：]\s*(.+)/i,
      /(.+)/, // フォールバック：全体をキーワードとして扱う
    ];

    for (const pattern of patterns) {
      const match = userInput.match(pattern);
      if (match && match[1]) {
        return match[1]
          .split(/[,、\n]/)
          .map(k => k.trim())
          .filter(k => k.length > 0);
      }
    }

    return [];
  }

  /**
   * 分類結果の解析
   */
  private parseClassificationResult(output: string): { immediate: string[]; later: string[] } {
    const immediate: string[] = [];
    const later: string[] = [];

    // 今すぐ客キーワードの抽出
    const immediateMatch = output.match(/【今すぐ客キーワード】([\\s\\S]*?)(?=【|$)/);
    if (immediateMatch && immediateMatch[1]) {
      immediate.push(...this.extractKeywordsFromSection(immediateMatch[1]));
    }

    // 後から客キーワードの抽出
    const laterMatch = output.match(/【後から客キーワード】([\\s\\S]*?)(?=【|$)/);
    if (laterMatch && laterMatch[1]) {
      later.push(...this.extractKeywordsFromSection(laterMatch[1]));
    }

    return { immediate, later };
  }

  /**
   * セクションからキーワードを抽出
   */
  private extractKeywordsFromSection(section: string): string[] {
    return section
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.replace(/^[-・]\s*/, '')) // リスト記号を除去
      .map(line => line.replace(/^\d+\.\s*/, '')); // 番号を除去
  }

  /**
   * RAG用データベースに変換・保存
   */
  async convertAndStore(): Promise<void> {
    if (this.processedData.length === 0) {
      throw new Error('処理されたデータがありません。先にloadFineTuningData()を実行してください');
    }

    console.log('RAG用データベースに変換・保存中...');

    for (const data of this.processedData) {
      try {
        await this.storeTrainingData(data);
      } catch (error) {
        console.error('データ保存エラー:', error, data);
        // エラーが発生しても処理を続行
      }
    }

    console.log('データ変換・保存が完了しました');
  }

  /**
   * 訓練データの保存
   */
  private async storeTrainingData(data: ProcessedFineTuningData): Promise<void> {
    // 統合コンテンツの作成
    const combinedContent = [
      ...data.keywords,
      ...data.classification.immediate.map(k => `今すぐ客:${k}`),
      ...data.classification.later.map(k => `後から客:${k}`)
    ].join(' ');

    // Embedding生成
    const embedding = await this.generateEmbedding(combinedContent);

    // メタデータの作成
    const keywordStats = this.analyzeKeywords([
      ...data.classification.immediate,
      ...data.classification.later
    ]);

    const trainingData: Omit<RAGTrainingData, 'id' | 'created_at' | 'updated_at'> = {
      input_keywords: data.keywords,
      output_classification: {
        immediate: data.classification.immediate,
        later: data.classification.later
      },
      combined_content: combinedContent,
      embedding,
      total_keywords: data.keywords.length,
      immediate_count: data.classification.immediate.length,
      later_count: data.classification.later.length,
      keyword_stats: keywordStats,
      data_source: 'finetune',
      confidence_score: 1.0,
      is_active: true
    };

    // 訓練データの保存
    const { data: insertedData, error: insertError } = await this.supabase
      .from('rag_training_data')
      .insert(trainingData)
      .select('id')
      .single();

    if (insertError) {
      throw new DatabaseError('訓練データの保存に失敗しました', { error: insertError });
    }

    // 個別キーワードの保存
    await this.storeIndividualKeywords(insertedData.id, data);
  }

  /**
   * 個別キーワードの保存
   */
  private async storeIndividualKeywords(
    trainingDataId: string, 
    data: ProcessedFineTuningData
  ): Promise<void> {
    const individualKeywords: Omit<RAGIndividualKeyword, 'id' | 'created_at'>[] = [];

    // 今すぐ客キーワード
    for (const keyword of data.classification.immediate) {
      const embedding = await this.generateEmbedding(keyword);
      const metadata = this.analyzeKeyword(keyword);
      
      individualKeywords.push({
        training_data_id: trainingDataId,
        keyword,
        normalized_keyword: this.normalizeKeyword(keyword),
        classification: 'immediate',
        keyword_embedding: embedding,
        service_type: metadata.service_type,
        region: metadata.region,
        has_region: metadata.has_region,
        has_urgency: metadata.has_urgency,
        has_price_info: metadata.has_price_info,
        confidence_score: 1.0
      });
    }

    // 後から客キーワード
    for (const keyword of data.classification.later) {
      const embedding = await this.generateEmbedding(keyword);
      const metadata = this.analyzeKeyword(keyword);
      
      individualKeywords.push({
        training_data_id: trainingDataId,
        keyword,
        normalized_keyword: this.normalizeKeyword(keyword),
        classification: 'later',
        keyword_embedding: embedding,
        service_type: metadata.service_type,
        region: metadata.region,
        has_region: metadata.has_region,
        has_urgency: metadata.has_urgency,
        has_price_info: metadata.has_price_info,
        confidence_score: 1.0
      });
    }

    // バッチ保存
    if (individualKeywords.length > 0) {
      const { error } = await this.supabase
        .from('rag_individual_keywords')
        .insert(individualKeywords);

      if (error) {
        throw new DatabaseError('個別キーワードの保存に失敗しました', { error });
      }
    }
  }

  /**
   * キーワードの分析
   */
  private analyzeKeyword(keyword: string) {
    // 地域の検出
    const regions = ['東京', '大阪', '名古屋', '福岡', '札幌', '仙台', '広島', '京都', '神戸', '横浜'];
    const hasRegion = regions.some(region => keyword.includes(region));
    const region = regions.find(region => keyword.includes(region));

    // 緊急性の検出
    const urgencyKeywords = ['即日', '今すぐ', '急ぎ', '緊急', '至急', '24時間'];
    const hasUrgency = urgencyKeywords.some(urgency => keyword.includes(urgency));

    // 価格情報の検出
    const priceKeywords = ['格安', '安い', '費用', '料金', '価格', '無料', 'お得'];
    const hasPriceInfo = priceKeywords.some(price => keyword.includes(price));

    // サービス類型の推定
    const serviceTypes = [
      { pattern: /清掃|掃除|クリーニング/, type: '清掃サービス' },
      { pattern: /リフォーム|工事|修理/, type: 'リフォーム' },
      { pattern: /引越し|引っ越し/, type: '引越しサービス' },
      { pattern: /税理士|会計/, type: '税務サービス' },
      { pattern: /弁護士|法律/, type: '法務サービス' },
      { pattern: /医療|病院|クリニック/, type: '医療サービス' },
      { pattern: /美容|エステ|脱毛/, type: '美容サービス' },
    ];

    const serviceType = serviceTypes.find(st => st.pattern.test(keyword))?.type;

    return {
      service_type: serviceType || null,
      region: region || null,
      has_region: hasRegion,
      has_urgency: hasUrgency,
      has_price_info: hasPriceInfo
    };
  }

  /**
   * キーワード統計の分析
   */
  private analyzeKeywords(keywords: string[]) {
    const stats = {
      total: keywords.length,
      regions: new Set<string>(),
      service_types: new Set<string>(),
      has_urgency_count: 0,
      has_price_info_count: 0
    };

    keywords.forEach(keyword => {
      const metadata = this.analyzeKeyword(keyword);
      
      if (metadata.region) stats.regions.add(metadata.region);
      if (metadata.service_type) stats.service_types.add(metadata.service_type);
      if (metadata.has_urgency) stats.has_urgency_count++;
      if (metadata.has_price_info) stats.has_price_info_count++;
    });

    return {
      total: stats.total,
      regions: Array.from(stats.regions),
      service_types: Array.from(stats.service_types),
      urgency_ratio: stats.has_urgency_count / stats.total,
      price_info_ratio: stats.has_price_info_count / stats.total
    };
  }

  /**
   * キーワードの正規化
   */
  private normalizeKeyword(keyword: string): string {
    return keyword
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' '); // 複数のスペースを単一のスペースに
  }

  /**
   * Embedding生成
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

  /**
   * インデックスの作成
   */
  async createIndexes(): Promise<void> {
    console.log('インデックス作成中...');
    
    try {
      // pgvectorインデックスの再構築（データが追加された後）
      await this.supabase.rpc('sql', {
        query: 'REINDEX INDEX rag_training_embedding_idx;'
      });

      await this.supabase.rpc('sql', {
        query: 'REINDEX INDEX rag_individual_embedding_idx;'
      });

      console.log('インデックス作成が完了しました');

    } catch (error) {
      console.error('インデックス作成中にエラーが発生しました:', error);
      // インデックス作成の失敗は致命的ではないため、処理を続行
    }
  }

  /**
   * データ統計の取得
   */
  async getStatistics() {
    const { data, error } = await this.supabase
      .rpc('get_keyword_statistics');

    if (error) {
      throw new DatabaseError('統計情報の取得に失敗しました', { error });
    }

    return data;
  }

  /**
   * サンプルデータの作成（テスト用）
   */
  async createSampleData(): Promise<void> {
    console.log('サンプルデータを作成中...');

    const sampleData: ProcessedFineTuningData[] = [
      {
        keywords: ['東京 ハウスクリーニング', '格安 清掃サービス', '今すぐ 掃除'],
        classification: {
          immediate: ['東京 ハウスクリーニング', '格安 清掃サービス', '今すぐ 掃除'],
          later: []
        },
        raw_input: 'キーワード: 東京 ハウスクリーニング, 格安 清掃サービス, 今すぐ 掃除',
        raw_output: '【今すぐ客キーワード】\n東京 ハウスクリーニング\n格安 清掃サービス\n今すぐ 掃除\n\n【後から客キーワード】\n'
      },
      {
        keywords: ['ハウスクリーニング とは', '清掃 方法', '掃除 コツ'],
        classification: {
          immediate: [],
          later: ['ハウスクリーニング とは', '清掃 方法', '掃除 コツ']
        },
        raw_input: 'キーワード: ハウスクリーニング とは, 清掃 方法, 掃除 コツ',
        raw_output: '【今すぐ客キーワード】\n\n【後から客キーワード】\nハウスクリーニング とは\n清掃 方法\n掃除 コツ'
      }
    ];

    this.processedData = sampleData;
    await this.convertAndStore();
    
    console.log('サンプルデータの作成が完了しました');
  }
}