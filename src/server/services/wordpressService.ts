import {
  WordPressExportData,
  WordPressPostResponse,
  WordPressSiteInfo,
  WordPressApiResult,
} from '@/types/wordpress';

// Add new interface for constructor arguments
export interface WordPressComAuth {
  accessToken: string;
  siteId: string; // This can be the site domain or the numeric site ID
}

export class WordPressService {
  private accessToken: string;
  private siteId: string;
  private baseUrl: string;

  constructor(auth: WordPressComAuth) {
    this.accessToken = auth.accessToken;
    this.siteId = auth.siteId;
    // Base URL for WordPress.com API v2
    this.baseUrl = `https://public-api.wordpress.com/wp/v2/sites/${this.siteId}`;
  }

  /**
   * WordPress.com接続テスト (サイト情報の取得)
   * API v2では /settings エンドポイントなどが考えられるが、v1.1のルートエンドポイントで情報が取れるか確認
   */
  async testConnection(): Promise<WordPressApiResult<WordPressSiteInfo>> {
    try {
      // v2 の場合、サイトの基本情報を取得するエンドポイントは /context または /settings などになる場合がある
      // もしくは v1.1 の /sites/{site_id} が v2 でも利用可能か確認が必要
      // ここでは一旦、v1.1の挙動に近い / エンドポイントで試みるが、API仕様の確認が最も重要
      const response = await fetch(
        `https://public-api.wordpress.com/rest/v1.1/sites/${this.siteId}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: response.statusText }));
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorBody.message || response.statusText}`,
        };
      }

      const siteData = await response.json();

      return {
        success: true,
        data: {
          name: siteData.name || siteData.title,
          url: siteData.URL || siteData.url,
          description: siteData.description,
        },
      };
    } catch (error) {
      console.error('Error in testConnection:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during testConnection',
      };
    }
  }

  /**
   * スラッグで既存コンテンツ (投稿または固定ページ) を検索 (WordPress.com API v2)
   */
  async findExistingContent(
    slug: string,
    type: 'posts' | 'pages' = 'posts'
  ): Promise<WordPressApiResult<WordPressPostResponse | null>> {
    try {
      const endpoint = `${this.baseUrl}/${type}?slug=${encodeURIComponent(slug)}`;
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
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
            Authorization: `Bearer ${this.accessToken}`,
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
            Authorization: `Bearer ${this.accessToken}`,
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
      console.log('WordPress API Response (Page):', JSON.stringify(pageResponse, null, 2));

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

  /**
   * WordPressに投稿としてエクスポート（新規作成または更新）(WordPress.com API v2)
   */
  async exportPostToWordPress(
    data: WordPressExportData
  ): Promise<WordPressApiResult<WordPressPostResponse>> {
    try {
      let existingPost: WordPressPostResponse | null = null;

      if (data.updateExisting && data.slug) {
        const findResult = await this.findExistingContent(data.slug, 'posts');
        if (findResult.success && findResult.data) {
          existingPost = findResult.data;
        }
      }

      let featuredMediaId: number | undefined;
      if (data.featuredImageUrl) {
        const mediaResult = await this.uploadFeaturedImage(data.featuredImageUrl);
        if (mediaResult.success && mediaResult.data) {
          featuredMediaId = mediaResult.data.id;
        }
      }

      const postData: {
        title: string;
        content: string;
        status: 'draft' | 'publish';
        excerpt?: string;
        slug?: string;
        featured_media?: number;
      } = {
        title: data.title,
        content: data.content,
        status: data.status,
      };
      if (data.excerpt) {
        postData.excerpt = data.excerpt;
      }
      if (data.slug) {
        postData.slug = data.slug;
      }
      if (featuredMediaId) {
        postData.featured_media = featuredMediaId;
      }

      let response: Response;
      let actionType: string;
      let endpoint: string;

      if (existingPost && existingPost.ID) {
        endpoint = `${this.baseUrl}/posts/${existingPost.ID}`;
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
          },
          body: JSON.stringify(postData),
        });
        actionType = '更新';
      } else {
        endpoint = `${this.baseUrl}/posts`;
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
          },
          body: JSON.stringify(postData),
        });
        actionType = '作成';
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        console.error(`投稿${actionType}エラー:`, endpoint, errorData);
        return {
          success: false,
          error: `投稿${actionType}エラー: ${errorData.message || response.statusText}`,
        };
      }

      const post: WordPressPostResponse = await response.json();
      console.log('WordPress API Response (Post):', JSON.stringify(post, null, 2));

      return {
        success: true,
        data: post,
        postUrl: post.link,
      };
    } catch (error) {
      console.error('Error in exportPostToWordPress:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error during exportPostToWordPress',
      };
    }
  }

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
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
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
