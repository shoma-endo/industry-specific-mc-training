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
    // Base URL for WordPress.com API v1.1
    this.baseUrl = `https://public-api.wordpress.com/rest/v1.1/sites/${this.siteId}`;
  }

  /**
   * WordPress.com接続テスト (サイト情報の取得)
   */
  async testConnection(): Promise<WordPressApiResult<WordPressSiteInfo>> {
    try {
      const response = await fetch(`${this.baseUrl}`, {
        // Endpoint to get site information
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: response.statusText }));
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorBody.message || response.statusText}`,
        };
      }

      const siteData = await response.json();

      // Map the response to WordPressSiteInfo
      // The structure of siteData will be different from wp-json/wp/v2/settings
      // Refer to WordPress.com API documentation for the exact structure
      // Example mapping (adjust based on actual response):
      return {
        success: true,
        data: {
          name: siteData.name || siteData.title, // .name is common, .title might exist
          url: siteData.URL || siteData.url, // .URL is common
          description: siteData.description, // .description might exist
        },
        // siteInfo is deprecated or redundant in this structure, data holds the info
        // siteInfo: {
        //   name: siteData.name || siteData.title,
        //   url: siteData.URL || siteData.url,
        //   description: siteData.description,
        // },
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
   * スラッグで既存投稿を検索 (WordPress.com API)
   */
  async findExistingPost(slug: string): Promise<WordPressApiResult<WordPressPostResponse | null>> {
    try {
      // WordPress.com API v1.1では、/posts エンドポイントで slug パラメータが利用できるか確認が必要。
      // 利用できない場合、?search=slug や、全件取得してフィルタリングするなどの代替策を検討。
      const response = await fetch(`${this.baseUrl}/posts?slug=${encodeURIComponent(slug)}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: response.statusText }));
        return {
          success: false,
          error: `投稿検索エラー (${slug}): ${errorBody.message || response.statusText}`,
        };
      }

      const result = await response.json();
      // WordPress.com APIのレスポンスは { found: number, posts: array } の形式になることが多い。
      const existingPost = result.posts && result.posts.length > 0 ? result.posts[0] : null;

      return {
        success: true,
        data: existingPost,
      };
    } catch (error) {
      console.error(`Error in findExistingPost for slug ${slug}:`, error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : `Unknown error during findExistingPost for ${slug}`,
      };
    }
  }

  /**
   * WordPressにエクスポート（新規作成または更新）(WordPress.com API)
   */
  async exportToWordPress(
    data: WordPressExportData
  ): Promise<WordPressApiResult<WordPressPostResponse>> {
    try {
      let existingPost: WordPressPostResponse | null = null;

      if (data.updateExisting && data.slug) {
        // Ensure slug exists for finding
        const findResult = await this.findExistingPost(data.slug);
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

      // WordPress.com API用の投稿データ構造に調整が必要な場合がある
      const postData: {
        title: string;
        content: string;
        excerpt: string;
        slug: string;
        status: 'draft' | 'publish';
        featured_image?: number; // featured_image をオプションプロパティとして追加
      } = {
        title: data.title,
        content: data.content,
        excerpt: data.excerpt || '',
        slug: data.slug,
        status: data.status,
        // featured_image は条件に応じて後から追加するため、初期値には含めない
      };
      if (featuredMediaId) {
        postData.featured_image = featuredMediaId; // Or the correct field name for WordPress.com API
      }

      let response: Response;
      let actionType: string;
      let endpoint: string;

      if (existingPost && existingPost.ID) {
        // WordPress.com APIではIDフィールド名が 'ID' (大文字) であることが多い
        // 既存投稿を更新
        endpoint = `${this.baseUrl}/posts/${existingPost.ID}`;
        response = await fetch(endpoint, {
          method: 'POST', // WordPress.com API v1.1では更新もPOSTを使うことが多い
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
          },
          body: JSON.stringify(postData),
        });
        actionType = '更新';
      } else {
        // 新規投稿作成
        endpoint = `${this.baseUrl}/posts/new`;
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

      return {
        success: true,
        data: post, // レスポンス構造を WordPressPostResponse に合わせる必要あり
        postUrl: post.URL, // WordPress.com APIではURLフィールド名が 'URL' (大文字) であることが多い
      };
    } catch (error) {
      console.error('Error in exportToWordPress:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during exportToWordPress',
      };
    }
  }

  /**
   * フィーチャード画像をアップロード (WordPress.com API)
   * WordPress.com API v1.1ではメディアアップロードに multipart/form-data を使用することが多い
   */
  private async uploadFeaturedImage(
    imageUrl: string
  ): Promise<WordPressApiResult<{ id: number; URL: string }>> {
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
      // 'media[]' はWordPress.com APIの期待するフィールド名。ドキュメントで確認。
      // または 'media[0]' のようにインデックスが必要な場合も。
      // 複数のファイルをアップロードする場合は 'media[]' で配列として送信するのが一般的。
      formData.append('media[]', imageBlob, filename);
      // formData.append('attrs[0][title]', 'My Awesome Image'); // オプションでタイトルなどの属性も指定可能
      // formData.append('attrs[0][caption]', 'This is a caption.');
      // formData.append('attrs[0][description]', 'Image description.');

      const uploadResponse = await fetch(`${this.baseUrl}/media/new`, {
        // または /media エンドポイント
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          // 'Content-Type': 'multipart/form-data' は通常ブラウザが自動で設定するが、明示しない方が良い場合もある。
          // Next.jsのfetchやnode-fetchでは手動設定が必要な場合あり。Node環境ではライブラリ(form-data)が必要になることも。
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
      // WordPress.com APIのレスポンスは { media: [...] } の形式で、配列の最初の要素がアップロードされたメディアになることが多い。
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
        data: { id: uploadedMedia.ID, URL: uploadedMedia.URL }, // IDとURLを返す
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
