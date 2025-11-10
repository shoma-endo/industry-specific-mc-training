/**
 * アプリケーション全体のエラーメッセージ定義
 *
 * エラーメッセージをカテゴリ別に一元管理することで：
 * - 文言の一貫性を保証
 * - 修正が一箇所で完結
 * - タイポや文言ブレを防止
 * - 拡張性を確保
 */

export const ERROR_MESSAGES = {
  /**
   * WordPress関連のエラーメッセージ
   */
  WORDPRESS: {
    /** WordPress設定が未登録・未完了の場合 */
    SETTINGS_INCOMPLETE:
      'WordPress設定が未完了です。設定ダッシュボードで接続設定を確認してください。',

    /** WordPress投稿タイプの取得に失敗した場合 */
    CONTENT_TYPE_FETCH_FAILED:
      'WordPressの投稿タイプを取得できませんでした。設定ダッシュボードでWordPress接続設定を確認してください。',

    /** WordPressへの接続に失敗した場合（汎用） */
    CONNECTION_FAILED:
      'WordPressへの接続に失敗しました。設定ダッシュボードで接続設定を確認してください。',

    /** WordPress投稿の取得に失敗した場合 */
    POSTS_FETCH_FAILED:
      'WordPress投稿の取得に失敗しました。設定ダッシュボードで接続設定を確認してください。',

    /** 接続テスト中のエラー */
    CONNECTION_TEST_ERROR: '接続テスト中に予期せぬエラーが発生しました',

    /** サーバーエラー（WordPress関連） */
    SERVER_ERROR: 'サーバーエラーが発生しました',
  },

  /**
   * 認証関連のエラーメッセージ
   */
  AUTH: {
    /** LINE認証に失敗した場合 */
    LIFF_AUTH_FAILED: 'LINE認証に失敗しました。LIFFから再ログインしてください。',
  },

  /**
   * 汎用エラーメッセージ
   */
  COMMON: {
    /** 一般的なサーバーエラー */
    SERVER_ERROR: 'サーバーエラーが発生しました',

    /** 予期しないエラー */
    UNEXPECTED_ERROR: '予期しないエラーが発生しました',

    /** ネットワークエラー */
    NETWORK_ERROR: 'ネットワークエラーが発生しました。接続を確認してください。',
  },
} as const;
