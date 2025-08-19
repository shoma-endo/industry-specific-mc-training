import { DomainError } from './BaseError';

export enum ChatErrorCode {
  // ネットワークエラー
  NETWORK_ERROR = 'CHAT_NETWORK_ERROR',
  CONNECTION_TIMEOUT = 'CHAT_CONNECTION_TIMEOUT',

  // 認証エラー
  AUTHENTICATION_FAILED = 'CHAT_AUTH_FAILED',
  TOKEN_EXPIRED = 'CHAT_TOKEN_EXPIRED',

  // サブスクリプションエラー
  SUBSCRIPTION_REQUIRED = 'CHAT_SUBSCRIPTION_REQUIRED',
  SUBSCRIPTION_EXPIRED = 'CHAT_SUBSCRIPTION_EXPIRED',

  // メッセージエラー
  VALIDATION_ERROR = 'CHAT_VALIDATION_ERROR',
  INVALID_MESSAGE = 'CHAT_INVALID_MESSAGE',
  MESSAGE_TOO_LONG = 'CHAT_MESSAGE_TOO_LONG',
  RATE_LIMIT_EXCEEDED = 'CHAT_RATE_LIMIT',

  // セッションエラー
  SESSION_NOT_FOUND = 'CHAT_SESSION_NOT_FOUND',
  SESSION_EXPIRED = 'CHAT_SESSION_EXPIRED',
  SESSION_CREATION_FAILED = 'CHAT_SESSION_CREATION_FAILED',
  SESSION_LOAD_FAILED = 'CHAT_SESSION_LOAD_FAILED',
  SESSION_DELETE_FAILED = 'CHAT_SESSION_DELETE_FAILED',

  // メッセージ送信エラー
  MESSAGE_SEND_FAILED = 'CHAT_MESSAGE_SEND_FAILED',
  MESSAGE_LOAD_FAILED = 'CHAT_MESSAGE_LOAD_FAILED',

  // AI関連エラー
  AI_SERVICE_ERROR = 'CHAT_AI_SERVICE_ERROR',
  MODEL_NOT_AVAILABLE = 'CHAT_MODEL_NOT_AVAILABLE',

  // 一般的なエラー
  UNKNOWN_ERROR = 'CHAT_UNKNOWN_ERROR',
}

export class ChatError extends DomainError {
  constructor(message: string, code: ChatErrorCode, context?: Record<string, unknown>) {
    const userMessage = ChatError.getUserMessage(code);
    super(message, code, userMessage, context);
  }

  private static getUserMessage(code: ChatErrorCode): string {
    const messages: Record<ChatErrorCode, string> = {
      [ChatErrorCode.NETWORK_ERROR]: 'AI通信に失敗しました',
      [ChatErrorCode.CONNECTION_TIMEOUT]: '接続がタイムアウトしました。再度お試しください。',
      [ChatErrorCode.AUTHENTICATION_FAILED]: 'ログインが必要です。LINEで再ログインしてください。',
      [ChatErrorCode.TOKEN_EXPIRED]: 'セッションが期限切れです。再ログインしてください。',
      [ChatErrorCode.SUBSCRIPTION_REQUIRED]: 'この機能を利用するにはサブスクリプションが必要です。',
      [ChatErrorCode.SUBSCRIPTION_EXPIRED]: 'サブスクリプションが期限切れです。更新してください。',
      [ChatErrorCode.VALIDATION_ERROR]: 'メッセージの検証に失敗しました。',
      [ChatErrorCode.INVALID_MESSAGE]: 'メッセージの形式が正しくありません。',
      [ChatErrorCode.MESSAGE_TOO_LONG]: 'メッセージが長すぎます。4000文字以内で入力してください。',
      [ChatErrorCode.RATE_LIMIT_EXCEEDED]:
        '送信回数が制限を超えています。しばらくしてから再度お試しください。',
      [ChatErrorCode.SESSION_NOT_FOUND]: 'チャットセッションが見つかりません。',
      [ChatErrorCode.SESSION_EXPIRED]:
        'チャットセッションが期限切れです。新しいチャットを開始してください。',
      [ChatErrorCode.SESSION_CREATION_FAILED]: 'チャットセッションの作成に失敗しました。',
      [ChatErrorCode.SESSION_LOAD_FAILED]: 'チャットセッションの読み込みに失敗しました。',
      [ChatErrorCode.SESSION_DELETE_FAILED]: 'チャットセッションの削除に失敗しました。',
      [ChatErrorCode.MESSAGE_SEND_FAILED]: 'メッセージの送信に失敗しました。',
      [ChatErrorCode.MESSAGE_LOAD_FAILED]: 'メッセージの読み込みに失敗しました。',
      [ChatErrorCode.AI_SERVICE_ERROR]:
        'AIサービスに問題が発生しています。しばらくしてから再度お試しください。',
      [ChatErrorCode.MODEL_NOT_AVAILABLE]:
        '選択されたAIモデルが利用できません。他のモデルをお試しください。',
      [ChatErrorCode.UNKNOWN_ERROR]:
        '予期せぬエラーが発生しました。サポートにお問い合わせください。',
    };

    return messages[code] || messages[ChatErrorCode.UNKNOWN_ERROR];
  }

  static fromApiError(error: unknown, context?: Record<string, unknown>): ChatError {
    if (error instanceof ChatError) {
      return error;
    }

    if (error instanceof Error) {
      // エラーメッセージからコードを推測
      const message = error.message.toLowerCase();

      if (message.includes('network') || message.includes('fetch')) {
        return new ChatError(error.message, ChatErrorCode.NETWORK_ERROR, context);
      }

      if (message.includes('timeout')) {
        return new ChatError(error.message, ChatErrorCode.CONNECTION_TIMEOUT, context);
      }

      if (message.includes('subscription')) {
        return new ChatError(error.message, ChatErrorCode.SUBSCRIPTION_REQUIRED, context);
      }

      if (message.includes('auth')) {
        return new ChatError(error.message, ChatErrorCode.AUTHENTICATION_FAILED, context);
      }

      return new ChatError(error.message, ChatErrorCode.UNKNOWN_ERROR, context);
    }

    return new ChatError('Unknown error occurred', ChatErrorCode.UNKNOWN_ERROR, {
      originalError: error,
      ...context,
    });
  }
}
