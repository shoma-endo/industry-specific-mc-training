/**
 * RAGキーワード分類システムの型定義
 */

// === API リクエスト・レスポンス型 ===

export interface ClassifyKeywordsRequest {
  keywords: string[]; // 最大20キーワード
  options?: {
    includeEvidence?: boolean; // 根拠を含めるか
    confidenceThreshold?: number; // 信頼度閾値
  };
}

export interface ClassifyKeywordsResponse {
  results: {
    immediate_customer: KeywordResult[];
    later_customer: KeywordResult[];
    unclassified: KeywordResult[];
  };
  evidence?: Evidence[];
  metadata: {
    totalProcessed: number;
    processingTime: number;
    confidence: number;
  };
}

export interface KeywordResult {
  keyword: string;
  classification: 'immediate' | 'later' | 'unclassified';
  confidence: number;
  similarKeywords?: string[];
}

export interface Evidence {
  keyword: string;
  similarExamples: {
    keyword: string;
    classification: string;
    similarity: number;
  }[];
}

// === データベース型 ===

export interface RAGTrainingData {
  id: string;
  input_keywords: string[];
  output_classification: Record<string, unknown>;
  combined_content: string;
  embedding?: number[];
  total_keywords: number;
  immediate_count: number;
  later_count: number;
  keyword_stats: Record<string, unknown>;
  data_source: string;
  confidence_score: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RAGIndividualKeyword {
  id: string;
  training_data_id: string;
  keyword: string;
  normalized_keyword: string;
  classification: 'immediate' | 'later';
  keyword_embedding?: number[];
  service_type?: string | null;
  region?: string | null;
  has_region: boolean;
  has_urgency: boolean;
  has_price_info: boolean;
  confidence_score: number;
  created_at: string;
}

// === 検索結果型 ===

export interface SimilarKeywordResult {
  keyword: string;
  classification: 'immediate' | 'later';
  similarity: number;
  service_type?: string;
  region?: string;
}

export interface HybridSearchResult {
  keyword: string;
  classification: 'immediate' | 'later';
  similarity: number;
  text_rank: number;
  combined_score: number;
}

export interface TrainingDataSearchResult {
  id: string;
  input_keywords: string[];
  output_classification: Record<string, unknown>;
  similarity: number;
  immediate_count: number;
  later_count: number;
}

// === 内部処理型 ===

export interface ClassificationOptions {
  includeEvidence?: boolean;
  confidenceThreshold?: number;
  maxSimilarExamples?: number;
}

export interface SearchResultByKeyword {
  keyword: string;
  similarExamples: HybridSearchResult[];
}

export interface KeywordClassificationContext {
  keyword: string;
  similarExamples: HybridSearchResult[];
  trainingExamples: TrainingDataSearchResult[];
}

// === ファインチューニングデータ変換型 ===

export interface FineTuningDataRow {
  user: string;
  system?: string;
  sysytem?: string; // 既存データのタイポに対応
  assistant?: string;
}

export interface ProcessedFineTuningData {
  keywords: string[];
  classification: {
    immediate: string[];
    later: string[];
  };
  raw_input: string;
  raw_output: string;
}

// === 統計・分析型 ===

export interface KeywordStatistics {
  total_keywords: number;
  immediate_keywords: number;
  later_keywords: number;
  service_types: string[];
  regions: string[];
  last_updated: string;
}

export interface ClassificationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  confusion_matrix: {
    immediate_to_immediate: number;
    immediate_to_later: number;
    later_to_immediate: number;
    later_to_later: number;
  };
}

// === ユーティリティ型 ===

export type ClassificationResult = 'immediate' | 'later' | 'unclassified';

export interface EmbeddingRequest {
  text: string;
  model?: string;
}

export interface EmbeddingResponse {
  embedding: number[];
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// === エラー型 ===

export class RAGClassificationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'RAGClassificationError';
  }
}

export class EmbeddingGenerationError extends RAGClassificationError {
  constructor(message: string, details?: unknown) {
    super(message, 'EMBEDDING_ERROR', details);
  }
}

export class DatabaseError extends RAGClassificationError {
  constructor(message: string, details?: unknown) {
    super(message, 'DATABASE_ERROR', details);
  }
}

export class ClassificationError extends RAGClassificationError {
  constructor(message: string, details?: unknown) {
    super(message, 'CLASSIFICATION_ERROR', details);
  }
}