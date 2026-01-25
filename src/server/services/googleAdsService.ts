import {
  GoogleTokenService,
  type GoogleOAuthTokens,
  type GoogleUserInfoResponse,
} from './googleTokenService';
import type {
  GoogleAdsKeywordMetric,
  GoogleAdsMatchType,
  GetKeywordMetricsInput,
  GetKeywordMetricsResult,
  GoogleAdsSearchStreamRow,
  GoogleAdsApiError,
} from '@/types/googleAds.types';

/** Google Ads API v22 のベース URL */
const GOOGLE_ADS_API_BASE_URL = 'https://googleads.googleapis.com/v22';

/**
 * micros 単位（1/1,000,000）を円に変換
 */
function microsToYen(micros: string | undefined): number {
  if (!micros) return 0;
  return Number(micros) / 1_000_000;
}

/**
 * マッチタイプを正規化
 */
function normalizeMatchType(matchType: string | undefined): GoogleAdsMatchType {
  switch (matchType) {
    case 'EXACT':
      return 'EXACT';
    case 'PHRASE':
      return 'PHRASE';
    case 'BROAD':
    default:
      return 'BROAD';
  }
}

/**
 * Google Ads API との通信を行うサービス
 * 認証トークンの管理および、キャンペーン情報や指標データの取得を担当する
 */
export class GoogleAdsService {
  private readonly tokenService: GoogleTokenService;

  constructor(tokenService?: GoogleTokenService) {
    this.tokenService = tokenService ?? new GoogleTokenService();
  }

  /**
   * 認証コードをアクセストークン等に交換する
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleOAuthTokens> {
    return this.tokenService.exchangeCodeForTokens(code, redirectUri);
  }

  /**
   * リフレッシュトークンを使用してアクセストークンを更新する
   */
  async refreshAccessToken(refreshToken: string): Promise<GoogleOAuthTokens> {
    try {
      return await this.tokenService.refreshAccessToken(refreshToken);
    } catch (error) {
      console.error('Google Ads Service: Failed to refresh access token', error);
      throw error;
    }
  }

  /**
   * アカウント階層（MCC配下のアカウントなど）を取得する
   * TODO: Google Ads API実装時に記述
   */
  async getAccountHierarchy(/* accessToken: string */) {
    // 実際の実装ではここで customerService.listAccessibleCustomers 等を呼ぶ
    return [];
  }

  /**
   * キャンペーンごとの主要指標を取得する
   * TODO: Google Ads API実装時に記述
   */
  async getCampaignMetrics(/* accessToken: string, customerId: string */) {
    // 実際の実装ではここで searchStream を使用してレポートを取得する
    return [];
  }

  /**
   * アクセストークンを使用してGoogleユーザー情報を取得する
   */
  async fetchUserInfo(accessToken: string): Promise<GoogleUserInfoResponse> {
    return this.tokenService.fetchUserInfo(accessToken);
  }

  /**
   * keyword_view からキーワード指標を取得する
   *
   * @param input - 取得パラメータ（アクセストークン、カスタマーID、日付範囲など）
   * @returns キーワード指標の配列
   */
  async getKeywordMetrics(input: GetKeywordMetricsInput): Promise<GetKeywordMetricsResult> {
    const { accessToken, customerId, startDate, endDate, campaignIds } = input;

    // GAQL クエリを構築
    let query = `
      SELECT
        ad_group_criterion.criterion_id,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        campaign.name,
        ad_group.name,
        metrics.ctr,
        metrics.average_cpc,
        metrics.historical_quality_score,
        metrics.conversions,
        metrics.cost_per_conversion,
        metrics.search_impression_share,
        metrics.conversions_from_interactions_rate,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros
      FROM keyword_view
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND ad_group_criterion.status = 'ENABLED'
        AND campaign.status = 'ENABLED'
    `;

    // キャンペーン ID フィルタを追加（任意）
    if (campaignIds && campaignIds.length > 0) {
      const campaignIdList = campaignIds.map((id) => `'${id}'`).join(', ');
      query += ` AND campaign.id IN (${campaignIdList})`;
    }

    query += `
      ORDER BY metrics.impressions DESC
      LIMIT 1000
    `;

    const url = `${GOOGLE_ADS_API_BASE_URL}/customers/${customerId}/googleAds:searchStream`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '',
        },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!response.ok) {
        const errorBody = (await response.json()) as GoogleAdsApiError;
        const errorMessage =
          errorBody.error?.message ?? `HTTP ${response.status}: ${response.statusText}`;
        console.error('[GoogleAdsService] API error:', errorBody);
        return { success: false, error: errorMessage };
      }

      const responseText = await response.text();

      // searchStream は NDJSON 形式で返却される
      const lines = responseText.split('\n').filter((line) => line.trim());
      const metrics: GoogleAdsKeywordMetric[] = [];

      for (const line of lines) {
        try {
          const chunk = JSON.parse(line) as { results?: GoogleAdsSearchStreamRow[] };
          if (!chunk.results) continue;

          for (const row of chunk.results) {
            const metric = this.parseKeywordMetricRow(row);
            if (metric) {
              metrics.push(metric);
            }
          }
        } catch (parseError) {
          console.warn('[GoogleAdsService] Failed to parse response line:', parseError);
        }
      }

      return { success: true, data: metrics };
    } catch (error) {
      console.error('[GoogleAdsService] getKeywordMetrics error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'キーワード指標の取得に失敗しました',
      };
    }
  }

  /**
   * API レスポンス行をキーワード指標オブジェクトに変換
   */
  private parseKeywordMetricRow(row: GoogleAdsSearchStreamRow): GoogleAdsKeywordMetric | null {
    const criterionId = row.adGroupCriterion?.criterionId;
    const keywordText = row.adGroupCriterion?.keyword?.text;

    // 必須フィールドがない場合はスキップ
    if (!criterionId || !keywordText) {
      return null;
    }

    const m = row.metrics ?? {};

    return {
      keywordId: criterionId,
      keywordText,
      matchType: normalizeMatchType(row.adGroupCriterion?.keyword?.matchType),
      campaignName: row.campaign?.name ?? '',
      adGroupName: row.adGroup?.name ?? '',

      // 主要指標
      ctr: m.ctr ?? 0,
      cpc: microsToYen(m.averageCpc),
      qualityScore: m.historicalQualityScore ?? null,
      conversions: m.conversions ?? 0,
      costPerConversion: m.costPerConversion ? microsToYen(m.costPerConversion) : null,
      searchImpressionShare: m.searchImpressionShare ?? null,
      conversionRate: m.conversionsFromInteractionsRate ?? null,

      // 補助指標
      impressions: Number(m.impressions ?? 0),
      clicks: Number(m.clicks ?? 0),
      cost: microsToYen(m.costMicros),
    };
  }
}
