import {
  GoogleTokenService,
  type GoogleOAuthTokens,
  type GoogleUserInfoResponse,
} from './googleTokenService';

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
      throw new Error('Google Ads開発者トークンが設定されていません');
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
   * 指定した customerId の表示名（descriptiveName）を取得する
   * searchStream を使って Customer リソースを取得
   * 取得に失敗した場合は null を返す（呼び出し側でフォールバックする想定）
   */
  async getCustomerDisplayName(
    customerId: string,
    accessToken: string,
    loginCustomerId?: string | null
  ): Promise<string | null> {
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!developerToken) {
      throw new Error('Google Ads開発者トークンが設定されていません');
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

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: `SELECT customer.descriptive_name FROM customer WHERE customer.id = ${customerId}`,
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
            // 審査中や無効化されたアカウント → 名前取得は諦めて静かにフォールバック
            // ログは出さない（ID表示で問題ない）
            return null;
          }
        } catch {
          // JSONパースに失敗した場合は通常のエラーログを出力
        }
        
        // その他のエラーのみログに出力
        console.warn('Google Ads API エラー (getCustomerDisplayName):', {
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
      return name && name.trim().length > 0 ? name : null;
    } catch (error) {
      console.error('Failed to fetch customer display name:', {
        customerId,
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
}
