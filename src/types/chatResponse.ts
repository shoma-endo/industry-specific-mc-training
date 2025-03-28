/**
 * チャットレスポンスの型定義
 */
export interface ChatResponse {
  message: string;
  error?: string;
  sessionId?: string;
  requiresSubscription?: boolean;
}
