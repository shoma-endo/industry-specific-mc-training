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
import { ERROR_MESSAGES } from '@/domain/errors/error-messages';

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
   * アクセス可能なGoogle Adsアカウント一覧を取得する
   * @param accessToken - OAuth アクセストークン
   * @returns アカウントIDの配列
   */
  async listAccessibleCustomers(accessToken: string): Promise<string[]> {
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!developerToken) {
      throw new Error(ERROR_MESSAGES.GOOGLE_ADS.DEVELOPER_TOKEN_MISSING);
    }

    const API_VERSION = 'v22';
    const url = `https://googleads.googleapis.com/${API_VERSION}/customers:listAccessibleCustomers`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'developer-token': developerToken,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      let errorMessage = `Google Adsアカウント一覧の取得に失敗しました: Status ${response.status}`;
      
      // エラーレスポンスをパースして詳細なエラーメッセージを抽出
      try {
        const errorData = JSON.parse(text) as {
          error?: {
            message?: string;
            details?: Array<{
              '@type'?: string;
              errors?: Array<{
                errorCode?: {
                  authenticationError?: string;
                };
                message?: string;
              }>;
            }>;
          };
        };
        
        if (errorData.error) {
          // 一般的なエラーメッセージ
          if (errorData.error.message) {
            errorMessage = errorData.error.message;
          }
          
          // Google Ads API固有のエラー詳細を抽出
          if (errorData.error.details && errorData.error.details.length > 0) {
            const adsError = errorData.error.details[0];
            if (adsError && adsError.errors && adsError.errors.length > 0) {
              const firstError = adsError.errors[0];
              if (firstError?.errorCode?.authenticationError === 'NOT_ADS_USER') {
                errorMessage = '認証したGoogleアカウントがGoogle Adsアカウントと関連付けられていません。Google Adsアカウントにアクセス権限があるGoogleアカウントで再認証してください。';
              } else if (firstError?.message) {
                errorMessage = firstError.message;
              }
            }
          }
        }
      } catch (parseError) {
        // JSONパースに失敗した場合は元のエラーメッセージを使用
        console.warn('Failed to parse error response:', parseError);
      }
      
      console.error('Google Ads API エラー:', {
        status: response.status,
        body: text,
        parsedMessage: errorMessage,
      });
      
      throw new Error(errorMessage);
    }

    const data = (await response.json()) as { resourceNames?: string[] };
    const resourceNames = data.resourceNames || [];

    // resourceNames の形式は "customers/1234567890" なので、ID部分を抽出
    return resourceNames.map(name => {
      const match = name.match(/^customers\/(.+)$/);
      return match && match[1] ? match[1] : name;
    });
  }

  /**
   * 指定した customerId の表示名とマネージャーアカウントかどうかを取得する
   * searchStream を使って Customer リソースを取得
   * 取得に失敗した場合は null を返す（呼び出し側でフォールバックする想定）
   */
  async getCustomerInfo(
    customerId: string,
    accessToken: string,
    loginCustomerId?: string | null
  ): Promise<{ name: string | null; isManager: boolean } | null> {
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!developerToken) {
      throw new Error(ERROR_MESSAGES.GOOGLE_ADS.DEVELOPER_TOKEN_MISSING);
    }

    const API_VERSION = 'v22';
    const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:searchStream`;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'developer-token': developerToken,
        Authorization: `Bearer ${accessToken}`,
      };

      // MCCアカウントから子アカウントの情報を取得する場合は login-customer-id が必要
      if (loginCustomerId) {
        headers['login-customer-id'] = loginCustomerId;
      }

      // デバッグログ: 実際に使用される値を確認（開発環境のみ）
      if (process.env.NODE_ENV === 'development') {
        console.log('[Google Ads] getCustomerInfo:', {
          targetCustomerId: customerId,
          loginCustomerId: loginCustomerId || '(none)',
          hasLoginCustomerId: !!loginCustomerId,
        });
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: `SELECT customer.descriptive_name, customer.manager FROM customer WHERE customer.id = ${customerId}`,
        }),
      });

      if (!response.ok) {
        const text = await response.text();

        // CUSTOMER_NOT_ENABLED エラー（審査中や無効化されたアカウント）の場合は静かにフォールバック
        try {
          const errorData = JSON.parse(text) as {
            error?: {
              details?: Array<{
                errors?: Array<{
                  errorCode?: {
                    authorizationError?: string;
                  };
                  message?: string;
                }>;
              }>;
            };
          };

          const firstError = errorData.error?.details?.[0]?.errors?.[0];
          const authError = firstError?.errorCode?.authorizationError;

          if (authError === 'CUSTOMER_NOT_ENABLED') {
            // 審査中や無効化されたアカウント → 情報取得は諦めて静かにフォールバック
            return null;
          }
        } catch {
          // JSONパースに失敗した場合は通常のエラーログを出力
        }

        // その他のエラーのみログに出力
        console.warn('Google Ads API エラー (getCustomerInfo):', {
          status: response.status,
          body: text,
          customerId,
        });
        return null;
      }

      // Google Ads API REST の searchStream は JSON 配列を返す
      // 各要素が SearchGoogleAdsStreamResponse オブジェクトで、その中に results プロパティがある
      const dataArray = (await response.json()) as Array<{
        results?: Array<{
          customer?: {
            descriptiveName?: string;
            descriptive_name?: string;
            manager?: boolean;
          };
        }>;
      }>;

      // 配列の最初の要素から results を取得
      const firstResponse = dataArray[0];
      if (!firstResponse?.results || firstResponse.results.length === 0) {
        return null;
      }

      const firstResult = firstResponse.results[0];
      if (!firstResult?.customer) {
        return null;
      }

      const name =
        firstResult.customer.descriptiveName ??
        firstResult.customer.descriptive_name ??
        null;
      return {
        name: name && name.trim().length > 0 ? name : null,
        isManager: firstResult.customer.manager === true,
      };
    } catch (error) {
      console.error('Failed to fetch customer info:', {
        customerId,
        error,
      });
      return null;
    }
  }

  /**
   * 指定したマネージャーアカウント配下にクライアントが存在するかを確認し、階層レベルを返す
   * 見つからない場合は null を返す
   */
  async getClientLevelUnderManager(
    managerCustomerId: string,
    clientCustomerId: string,
    accessToken: string
  ): Promise<number | null> {
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!developerToken) {
      throw new Error(ERROR_MESSAGES.GOOGLE_ADS.DEVELOPER_TOKEN_MISSING);
    }

    const API_VERSION = 'v22';
    const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${managerCustomerId}/googleAds:searchStream`;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'developer-token': developerToken,
        Authorization: `Bearer ${accessToken}`,
        'login-customer-id': managerCustomerId,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: `SELECT customer_client.level FROM customer_client WHERE customer_client.client_customer = 'customers/${clientCustomerId}'`,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.warn('Google Ads API エラー (getClientLevelUnderManager):', {
          status: response.status,
          body: text,
          managerCustomerId,
          clientCustomerId,
        });
        return null;
      }

      const text = await response.text();
      let responses: Array<{
        results?: Array<{
          customerClient?: {
            level?: number;
          };
        }>;
      }> = [];

      try {
        const parsed = JSON.parse(text) as unknown;
        if (Array.isArray(parsed)) {
          responses = parsed as typeof responses;
        } else if (parsed && typeof parsed === 'object') {
          responses = [parsed as typeof responses[number]];
        }
      } catch {
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        for (const line of lines) {
          try {
            responses.push(JSON.parse(line) as typeof responses[number]);
          } catch {
            // 不正な行はスキップ
          }
        }
      }

      for (const responseChunk of responses) {
        const result = responseChunk.results?.[0];
        const level = result?.customerClient?.level;
        if (typeof level === 'number') {
          return level;
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to fetch customer client level:', {
        managerCustomerId,
        clientCustomerId,
        error,
      });
      return null;
    }
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
    const { accessToken, customerId, startDate, endDate, campaignIds, loginCustomerId } = input;

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
    // campaignIds は数値のみ（スキーマでバリデーション済み）のため、クオートなしで結合
    if (campaignIds && campaignIds.length > 0) {
      const campaignIdList = campaignIds.join(', ');
      query += ` AND campaign.id IN (${campaignIdList})`;
    }

    query += `
      ORDER BY metrics.impressions DESC
      LIMIT 1000
    `;

    const url = `${GOOGLE_ADS_API_BASE_URL}/customers/${customerId}/googleAds:searchStream`;

    // リクエストヘッダーを構築
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '',
    };

    // MCCアカウントから子アカウントの情報を取得する場合は login-customer-id が必要
    if (loginCustomerId) {
      headers['login-customer-id'] = loginCustomerId;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorBody = (await response.json()) as GoogleAdsApiError;
          errorMessage = errorBody.error?.message ?? errorMessage;

          // デバッグ用: エラー詳細をログ出力（エラーコードを含む）
          const errorDetails = errorBody.error?.details?.[0];
          const errorCode = errorDetails?.errors?.[0]?.errorCode
            ? Object.values(errorDetails.errors[0].errorCode)[0]
            : undefined;

          console.error('[GoogleAdsService] API error:', {
            status: response.status,
            message: errorMessage,
            errorCode,
            customerId,
          });
        } catch {
          console.error(
            '[GoogleAdsService] API error (non-JSON response):',
            response.status,
            response.statusText
          );
        }
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
