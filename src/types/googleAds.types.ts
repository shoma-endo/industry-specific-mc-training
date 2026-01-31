/**
 * Google Ads キーワードのマッチタイプ
 */
export type GoogleAdsMatchType = 'EXACT' | 'PHRASE' | 'BROAD';

/**
 * Google Ads キーワード指標
 * keyword_view から取得する広告パフォーマンス指標
 */
export interface GoogleAdsKeywordMetric {
  /** キーワード ID（ad_group_criterion.criterion_id） */
  keywordId: string;
  /** キーワードテキスト */
  keywordText: string;
  /** マッチタイプ */
  matchType: GoogleAdsMatchType;
  /** キャンペーン名 */
  campaignName: string;
  /** 広告グループ名 */
  adGroupName: string;

  // ===== 7つの主要指標 =====
  /** CTR（クリック率）: 0〜1 の割合 */
  ctr: number;
  /** CPC（平均クリック単価）: 円換算済み */
  cpc: number;
  /** 品質スコア: 1〜10、未算出の場合は null */
  qualityScore: number | null;
  /** コンバージョン数 */
  conversions: number;
  /** コンバージョン単価: 円換算済み、コンバージョンがない場合は null */
  costPerConversion: number | null;
  /** 検索インプレッションシェア: 0〜1 の割合、未算出の場合は null */
  searchImpressionShare: number | null;
  /** コンバージョン率: 0〜1 の割合 */
  conversionRate: number | null;

  // ===== 補助指標 =====
  /** インプレッション数（表示回数） */
  impressions: number;
  /** クリック数 */
  clicks: number;
  /** コスト（費用）: 円換算済み */
  cost: number;
}

/**
 * キーワード指標取得の入力パラメータ
 */
export interface GetKeywordMetricsInput {
  /** Google OAuth アクセストークン */
  accessToken: string;
  /** Google Ads カスタマー ID（ハイフンなし 10桁） */
  customerId: string;
  /** 開始日（YYYY-MM-DD 形式） */
  startDate: string;
  /** 終了日（YYYY-MM-DD 形式） */
  endDate: string;
  /** キャンペーン ID でフィルタ（任意） */
  campaignIds?: string[];
}

/**
 * キーワード指標取得の結果
 */
export interface GetKeywordMetricsResult {
  success: boolean;
  data?: GoogleAdsKeywordMetric[];
  error?: string;
}

/**
 * Google Ads API の searchStream レスポンス行
 */
export interface GoogleAdsSearchStreamRow {
  adGroupCriterion?: {
    criterionId?: string;
    keyword?: {
      text?: string;
      matchType?: string;
    };
  };
  campaign?: {
    name?: string;
  };
  adGroup?: {
    name?: string;
  };
  metrics?: {
    ctr?: number;
    averageCpc?: string; // micros (string)
    historicalQualityScore?: number;
    conversions?: number;
    costPerConversion?: string; // micros (string)
    searchImpressionShare?: number;
    conversionsFromInteractionsRate?: number;
    impressions?: string;
    clicks?: string;
    costMicros?: string;
  };
}

/**
 * Google Ads API のエラーレスポンス
 */
export interface GoogleAdsApiError {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: Array<{
      '@type'?: string;
      errors?: Array<{
        errorCode?: Record<string, string>;
        message?: string;
      }>;
    }>;
  };
}
