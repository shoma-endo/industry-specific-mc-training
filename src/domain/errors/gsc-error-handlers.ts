/**
 * Google Search Console エラーハンドリング関連のユーティリティ
 */

/**
 * トークン期限切れ/取り消しエラーかどうかを判定
 *
 * @param message - エラーメッセージ
 * @returns トークンエラーの場合は true
 */
export function isTokenExpiredError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('invalid_grant') ||
    lower.includes('token has been expired') ||
    lower.includes('token has been revoked') ||
    lower.includes('トークンリフレッシュに失敗')
  );
}
