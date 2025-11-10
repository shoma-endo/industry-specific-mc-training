/**
 * WordPress関連のエラーメッセージ定義
 *
 * エラーメッセージを一元管理することで：
 * - 文言の一貫性を保証
 * - 修正が一箇所で完結
 * - タイポや文言ブレを防止
 */

export const WORDPRESS_ERROR_MESSAGES = {
  /** WordPress設定が未登録・未完了の場合 */
  SETTINGS_INCOMPLETE: 'WordPress設定が未完了です。設定ダッシュボードで接続設定を確認してください。',

  /** WordPress投稿タイプの取得に失敗した場合 */
  CONTENT_TYPE_FETCH_FAILED: 'WordPressの投稿タイプを取得できませんでした。設定ダッシュボードでWordPress接続設定を確認してください。',

  /** WordPressへの接続に失敗した場合（汎用） */
  CONNECTION_FAILED: 'WordPressへの接続に失敗しました。設定ダッシュボードで接続設定を確認してください。',

  /** WordPress投稿の取得に失敗した場合 */
  POSTS_FETCH_FAILED: 'WordPress投稿の取得に失敗しました。設定ダッシュボードで接続設定を確認してください。',

  /** 接続テスト中のエラー */
  CONNECTION_TEST_ERROR: '接続テスト中に予期せぬエラーが発生しました',

  /** サーバーエラー（汎用） */
  SERVER_ERROR: 'サーバーエラーが発生しました',
} as const;

/**
 * LINE認証関連のエラーメッセージ
 */
export const AUTH_ERROR_MESSAGES = {
  /** LINE認証に失敗した場合 */
  LIFF_AUTH_FAILED: 'LINE認証に失敗しました。LIFFから再ログインしてください。',
} as const;
