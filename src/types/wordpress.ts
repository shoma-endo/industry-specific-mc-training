/**
 * WordPress設定の種類
 */
export type WordPressType = 'wordpress_com' | 'self_hosted';

/**
 * WordPress設定（統合型）
 */
export interface WordPressSettings {
  id?: string;
  userId: string;
  wpType: WordPressType;
  // WordPress.com用
  wpClientId?: string;
  wpClientSecret?: string;
  wpSiteId?: string;
  wpAccessToken?: string;
  wpRefreshToken?: string;
  wpTokenExpiresAt?: string;
  // セルフホスト用
  wpSiteUrl?: string;
  wpUsername?: string;
  wpApplicationPassword?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * WordPress API レスポンス (WordPress.com API v2 向け)
 */
export interface WordPressPostResponse {
  ID: number;
  link: string;
  status: string;
  title: { raw: string; rendered: string } | string;
  content: { raw: string; rendered: string } | string;
  excerpt?: { raw: string; rendered: string } | string;
  author?: { ID: number; login: string; name: string; URL: string; avatar_URL: string };
  date?: string;
  modified?: string;
  featured_image?: string;
  slug?: string;
}

/**
 * WordPress サイト情報 (WordPress.com API v1.1 向け)
 */
export interface WordPressSiteInfo {
  ID?: number;
  name: string;
  url: string; // WordPress.com APIのレスポンスは `URL` (大文字) の場合が多いので注意。サービス側でマッピングを推奨
  description?: string;
  jetpack?: boolean;
  // 他のWordPress.com APIのフィールドも必要に応じて追加
}

/**
 * API結果型
 */
export interface WordPressApiResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  siteInfo?: WordPressSiteInfo; // testConnection で使用していたが、dataに含める形に変更したため、重複の可能性あり
}

export type WordPressRenderedField = { rendered?: string } | string | undefined;

export interface WordPressRestTerm {
  id?: number;
  name?: string;
}

export interface WordPressRestPost {
  id?: number;
  ID?: number;
  date?: string;
  modified?: string;
  title?: WordPressRenderedField;
  link?: string;
  categories?: number[];
  excerpt?: WordPressRenderedField;
  yoast_head_json?: {
    canonical?: string;
  };
  _embedded?: {
    'wp:term'?: Array<Array<WordPressRestTerm>>;
  };
}

export interface WordPressNormalizedPost {
  id: number | string | undefined;
  date?: string;
  title?: string;
  link?: string;
  canonical_url?: string;
  categories?: number[];
  categoryNames: string[];
  excerpt?: string;
}
