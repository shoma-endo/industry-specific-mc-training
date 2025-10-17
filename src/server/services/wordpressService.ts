import { WordPressPostResponse, WordPressSiteInfo, WordPressApiResult, WordPressType } from '@/types/wordpress';

// WordPress.com認証情報
export interface WordPressComAuth {
  accessToken: string;
  siteId: string; // This can be the site domain or the numeric site ID
}

// セルフホストWordPress認証情報
export interface SelfHostedAuth {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

// 統合認証情報
export interface WordPressAuth {
  type: WordPressType;
  wpComAuth?: WordPressComAuth;
  selfHostedAuth?: SelfHostedAuth;
}

export class WordPressService {
  private type: WordPressType;
  private accessToken?: string;
  private siteId?: string;
  private siteUrl?: string;
  private username?: string;
  private applicationPassword?: string;
  private baseUrl: string;

  // 後方互換性のため、既存のWordPress.com用コンストラクタを維持
  constructor(auth: WordPressComAuth);
  // 新しい統合認証用コンストラクタ
  constructor(auth: WordPressAuth);
  constructor(auth: WordPressComAuth | WordPressAuth) {
    if ('type' in auth) {
      // 新しい統合認証
      this.type = auth.type;
      if (auth.type === 'wordpress_com' && auth.wpComAuth) {
        this.accessToken = auth.wpComAuth.accessToken;
        this.siteId = auth.wpComAuth.siteId;
        this.baseUrl = `https://public-api.wordpress.com/wp/v2/sites/${this.siteId}`;
      } else if (auth.type === 'self_hosted' && auth.selfHostedAuth) {
        this.siteUrl = auth.selfHostedAuth.siteUrl;
        this.username = auth.selfHostedAuth.username;
        this.applicationPassword = auth.selfHostedAuth.applicationPassword;
        this.baseUrl = `${this.siteUrl.replace(/\/$/, '')}/wp-json/wp/v2`;
      } else {
        throw new Error('Invalid authentication configuration');
      }
    } else {
      // 既存のWordPress.com用認証（後方互換性）
      this.type = 'wordpress_com';
      this.accessToken = auth.accessToken;
      this.siteId = auth.siteId;
      this.baseUrl = `https://public-api.wordpress.com/wp/v2/sites/${this.siteId}`;
    }
  }

  /**
   * 認証ヘッダーを取得
   */
  private getAuthHeaders(): Record<string, string> {
    const commonHeaders: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'IndustrySpecificMC/1.0 (+app)',
    };

    if (this.type === 'wordpress_com') {
      return {
        ...commonHeaders,
        Authorization: `Bearer ${this.accessToken}`,
      };
    } else {
      // セルフホスト版：Basic認証
      const credentials = btoa(`${this.username}:${this.applicationPassword}`);
      return {
        ...commonHeaders,
        Authorization: `Basic ${credentials}`,
      };
    }
  }

  /**
   * 統合接続テスト（WordPress.comとセルフホスト両対応）
   */
  async testConnection(): Promise<WordPressApiResult<WordPressSiteInfo>> {
    try {
      let response: Response;

      if (this.type === 'wordpress_com') {
        // WordPress.com用：v1.1 APIを使用
        response = await fetch(`https://public-api.wordpress.com/rest/v1.1/sites/${this.siteId}`, {
          headers: this.getAuthHeaders(),
        });
      } else {
        // セルフホスト用：段階テスト（到達 -> 認証 -> 権限）
        // 1) 到達確認
        const rootUrl = `${(this.siteUrl || '').replace(/\/$/, '')}/wp-json/`;
        const reachabilityResp = await fetch(rootUrl, {
          headers: { Accept: 'application/json', 'User-Agent': 'IndustrySpecificMC/1.0 (+app)' },
        });
        if (!reachabilityResp.ok) {
          // Xserver等で /wp-json/ がブロックされる場合のフォールバック
          const altRoot = `${(this.siteUrl || '').replace(/\/$/, '')}/index.php?rest_route=/`;
          const altResp = await fetch(altRoot, {
            headers: { Accept: 'application/json', 'User-Agent': 'IndustrySpecificMC/1.0 (+app)' },
          });
          if (!altResp.ok) {
            const bodyText = await reachabilityResp.text().catch(() => reachabilityResp.statusText);
            const altText = await altResp.text().catch(() => altResp.statusText);
            return {
              success: false,
              error: `[reachability] HTTP ${reachabilityResp.status}: ${bodyText || reachabilityResp.statusText} | alt HTTP ${altResp.status}: ${altText || altResp.statusText}`,
            };
          }
        }

        // 2) 認証確認（ユーザー情報取得）
        const authResp = await fetch(`${this.baseUrl}/users/me`, {
          headers: this.getAuthHeaders(),
        });
        if (!authResp.ok) {
          // フォールバック: index.php?rest_route=
          const altAuthUrl = `${(this.siteUrl || '').replace(/\/$/, '')}/index.php?rest_route=/wp/v2/users/me`;
          const altAuthResp = await fetch(altAuthUrl, { headers: this.getAuthHeaders() });
          if (!altAuthResp.ok) {
            const authErrBody = await authResp.text().catch(() => authResp.statusText);
            const altAuthBody = await altAuthResp.text().catch(() => altAuthResp.statusText);
            const stage =
              authResp.status === 401 || altAuthResp.status === 401
                ? 'authentication'
                : 'auth_or_waf';
            return {
              success: false,
              error: `[${stage}] HTTP ${authResp.status}: ${authErrBody || authResp.statusText} | alt HTTP ${altAuthResp.status}: ${altAuthBody || altAuthResp.statusText}`,
            };
          }
        }

        // 3) 権限確認（設定エンドポイント）
        response = await fetch(`${this.baseUrl}/settings`, {
          headers: this.getAuthHeaders(),
        });
        if (!response.ok) {
          // フォールバック: index.php?rest_route=
          const altSettingsUrl = `${(this.siteUrl || '').replace(/\/$/, '')}/index.php?rest_route=/wp/v2/settings`;
          const altSettingsResp = await fetch(altSettingsUrl, { headers: this.getAuthHeaders() });
          if (!altSettingsResp.ok) {
            const bodyText = await response.text().catch(() => response.statusText);
            const altText = await altSettingsResp.text().catch(() => altSettingsResp.statusText);
            return {
              success: false,
              error: `[permission_or_waf] HTTP ${response.status}: ${bodyText || response.statusText} | alt HTTP ${altSettingsResp.status}: ${altText || altSettingsResp.statusText}`,
            };
          }
          // フォールバック成功時は以降の処理で altSettingsResp を使う
          response = altSettingsResp as unknown as Response;
        }
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: response.statusText }));
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorBody.message || response.statusText}`,
        };
      }

      const siteData = await response.json();

      if (this.type === 'wordpress_com') {
        return {
          success: true,
          data: {
            name: siteData.name || siteData.title,
            url: siteData.URL || siteData.url,
            description: siteData.description,
          },
        };
      } else {
        // セルフホスト版の場合、設定からサイト情報を取得
        return {
          success: true,
          data: {
            name: siteData.title || 'WordPress Site',
            url: this.siteUrl || '',
            description: siteData.description || '',
          },
        };
      }
    } catch (error) {
      console.error('Error in testConnection:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during testConnection',
      };
    }
  }

  /**
   * スラッグで既存コンテンツ (投稿または固定ページ) を検索（WordPress.comとセルフホスト両対応）
   */
  async findExistingContent(
    slug: string,
    type: 'posts' | 'pages' = 'posts'
  ): Promise<WordPressApiResult<WordPressPostResponse | null>> {
    try {
      const endpoint = `${this.baseUrl}/${type}?slug=${encodeURIComponent(slug)}`;
      const response = await fetch(endpoint, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { success: true, data: null }; // Not found is not an error here
        }
        const errorBody = await response.json().catch(() => ({ message: response.statusText }));
        return {
          success: false,
          error: `${type === 'pages' ? '固定ページ' : '投稿'}検索エラー (${slug}): ${errorBody.message || response.statusText}`,
        };
      }

      const items: WordPressPostResponse[] = await response.json();
      let resultData: WordPressPostResponse | null = null;

      const exactMatch = items.find(item => item.slug === slug);

      if (exactMatch) {
        resultData = exactMatch;
      } else if (items && items.length > 0 && items[0] !== undefined) {
        resultData = items[0];
      }

      return {
        success: true,
        data: resultData,
      };
    } catch (error) {
      console.error(`Error in findExistingContent for slug ${slug} (type: ${type}):`, error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : `Unknown error during findExistingContent for ${slug} (type: ${type})`,
      };
    }
  }

}
