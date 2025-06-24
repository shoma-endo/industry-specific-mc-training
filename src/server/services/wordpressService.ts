import {
  WordPressExportData,
  WordPressPostResponse,
  WordPressSiteInfo,
  WordPressApiResult,
  WordPressType,
} from '@/types/wordpress';

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
    if (this.type === 'wordpress_com') {
      return {
        Authorization: `Bearer ${this.accessToken}`,
      };
    } else {
      // セルフホスト版：Basic認証
      const credentials = btoa(`${this.username}:${this.applicationPassword}`);
      return {
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
        response = await fetch(
          `https://public-api.wordpress.com/rest/v1.1/sites/${this.siteId}`,
          {
            headers: this.getAuthHeaders(),
          }
        );
      } else {
        // セルフホスト用：設定エンドポイントまたはルートエンドポイントをテスト
        response = await fetch(
          `${this.baseUrl}/settings`,
          {
            headers: this.getAuthHeaders(),
          }
        );
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

  /**
   * WordPressに固定ページとしてエクスポート（新規作成または更新）(WordPress.com API v2)
   */
  async exportPageToWordPress(
    data: WordPressExportData
  ): Promise<WordPressApiResult<WordPressPostResponse>> {
    try {
      let existingPage: WordPressPostResponse | null = null;

      if (data.updateExisting && data.slug) {
        const findResult = await this.findExistingContent(data.slug, 'pages');
        if (findResult.success && findResult.data) {
          existingPage = findResult.data;
        }
      }

      let featuredMediaId: number | undefined;
      if (data.featuredImageUrl) {
        const mediaResult = await this.uploadFeaturedImage(data.featuredImageUrl);
        if (mediaResult.success && mediaResult.data) {
          featuredMediaId = mediaResult.data.id;
        }
      }

      const pageData: {
        title: string;
        content: string;
        status: 'draft' | 'publish';
        excerpt?: string;
        slug?: string;
        featured_media?: number;
        template?: string;
      } = {
        title: data.title,
        content: data.content,
        status: data.status,
      };

      if (data.excerpt) {
        pageData.excerpt = data.excerpt;
      }
      if (data.slug) {
        pageData.slug = data.slug;
      }

      if (featuredMediaId) {
        pageData.featured_media = featuredMediaId;
      }

      let response: Response;
      let actionType: string;
      let endpoint: string;

      if (existingPage && existingPage.ID) {
        endpoint = `${this.baseUrl}/pages/${existingPage.ID}`;
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders(),
          },
          body: JSON.stringify(pageData),
        });
        actionType = '更新';
      } else {
        endpoint = `${this.baseUrl}/pages`;
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders(),
          },
          body: JSON.stringify(pageData),
        });
        actionType = '作成';
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        console.error(`固定ページ${actionType}エラー:`, endpoint, errorData);
        return {
          success: false,
          error:
            `固定ページ${actionType}エラー: ${errorData.message || response.statusText}` +
            (errorData.error ? ` (${errorData.error})` : ''),
        };
      }

      const pageResponse: WordPressPostResponse = await response.json();

      return {
        success: true,
        data: pageResponse,
        postUrl: pageResponse.link,
      };
    } catch (error) {
      console.error('Error in exportPageToWordPress:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error during exportPageToWordPress',
      };
    }
  }

  // exportPostToWordPress は削除されました（現在のフローでは不要）

  /**
   * フィーチャード画像をアップロード (WordPress.com API v1.1)
   * 注意: このメソッドはv1.1 APIを対象としています。
   * v2 APIでメディアを扱う場合は仕様確認と修正が必要です。
   */
  private async uploadFeaturedImage(
    imageUrl: string
  ): Promise<WordPressApiResult<{ id: number; URL: string }>> {
    // v1.1のメディアアップロードエンドポイントを使用
    const v1MediaUploadUrl = `https://public-api.wordpress.com/rest/v1.1/sites/${this.siteId}/media/new`;
    try {
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        return {
          success: false,
          error: 'フィーチャード画像の取得に失敗しました',
        };
      }

      const imageBlob = await imageResponse.blob();
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
      const filename = `featured-image-${Date.now()}.${contentType.split('/')[1] || 'jpg'}`;

      const formData = new FormData();
      formData.append('media[]', imageBlob, filename);

      const uploadResponse = await fetch(v1MediaUploadUrl, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse
          .json()
          .catch(() => ({ message: uploadResponse.statusText }));
        console.error('画像アップロードエラー:', errorData);
        return {
          success: false,
          error: `画像アップロードエラー: ${errorData.message || uploadResponse.statusText}`,
        };
      }

      const mediaData = await uploadResponse.json();
      const uploadedMedia =
        mediaData.media && mediaData.media.length > 0 ? mediaData.media[0] : null;

      if (!uploadedMedia || !uploadedMedia.ID) {
        console.error('アップロードされたメディア情報が不正です:', mediaData);
        return {
          success: false,
          error: 'アップロードされたメディア情報が不正です',
        };
      }

      return {
        success: true,
        data: { id: uploadedMedia.ID, URL: uploadedMedia.URL },
      };
    } catch (error) {
      console.error('Error in uploadFeaturedImage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during uploadFeaturedImage',
      };
    }
  }
}
