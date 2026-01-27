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
}
