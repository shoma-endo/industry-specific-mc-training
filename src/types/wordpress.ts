/**
 * WordPress認証情報 (OAuth移行後はaccessTokenとsiteIdが主になるため、これは旧定義)
 */
export interface WordPressCredentials {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

/**
 * WordPressエクスポート用データ
 */
export interface WordPressExportData {
  title: string;
  content: string;
  excerpt?: string;
  slug: string;
  status: 'draft' | 'publish';
  featuredImageUrl?: string;
  updateExisting?: boolean; // 既存投稿を更新するかどうか
}

/**
 * WordPress API レスポンス (WordPress.com API v1.1 向け)
 */
export interface WordPressPostResponse {
  ID: number; // id から ID に変更
  URL: string; // link から URL に変更
  status: string;
  title: string; // title.rendered から title に変更 (実際のAPIレスポンス構造に合わせて調整)
  content: string; // content.rendered から content に変更 (実際のAPIレスポンス構造に合わせて調整)
  excerpt?: string;
  author?: { ID: number; login: string; name: string; URL: string; avatar_URL: string };
  date?: string;
  modified?: string;
  featured_image?: string;
  slug?: string; // WordPress.com APIの投稿オブジェクトには通常slugが含まれる
  // 他のWordPress.com APIのフィールドも必要に応じて追加
  // 例: terms, tags, categories など
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
  postUrl?: string; // exportToWordPress で使用
  siteInfo?: WordPressSiteInfo; // testConnection で使用していたが、dataに含める形に変更したため、重複の可能性あり
}
