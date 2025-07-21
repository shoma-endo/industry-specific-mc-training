import { DomainError } from './BaseError';

export enum SubscriptionErrorCode {
  CHECK_FAILED = 'SUBSCRIPTION_CHECK_FAILED',
  CREATION_FAILED = 'SUBSCRIPTION_CREATION_FAILED',
  PAYMENT_FAILED = 'SUBSCRIPTION_PAYMENT_FAILED',
  CANCELLATION_FAILED = 'SUBSCRIPTION_CANCELLATION_FAILED',
  INVALID_STATUS = 'SUBSCRIPTION_INVALID_STATUS',
  NETWORK_ERROR = 'SUBSCRIPTION_NETWORK_ERROR',
  AUTHENTICATION_FAILED = 'SUBSCRIPTION_AUTHENTICATION_FAILED',
  ACCESS_DENIED = 'SUBSCRIPTION_ACCESS_DENIED',
  STRIPE_ERROR = 'SUBSCRIPTION_STRIPE_ERROR',
  WEBHOOK_ERROR = 'SUBSCRIPTION_WEBHOOK_ERROR',
}

export class SubscriptionError extends DomainError {
  constructor(
    userMessage: string,
    code: SubscriptionErrorCode,
    context?: Record<string, unknown>
  ) {
    super(userMessage, code, userMessage, context);
    this.name = 'SubscriptionError';
  }

  static checkFailed(error?: unknown): SubscriptionError {
    return new SubscriptionError(
      'サブスクリプション状況の確認に失敗しました。しばらく経ってから再度お試しください。',
      SubscriptionErrorCode.CHECK_FAILED,
      { originalError: error }
    );
  }

  static creationFailed(error?: unknown): SubscriptionError {
    return new SubscriptionError(
      'サブスクリプションの作成に失敗しました。お支払い情報を確認してください。',
      SubscriptionErrorCode.CREATION_FAILED,
      { originalError: error }
    );
  }

  static paymentFailed(error?: unknown): SubscriptionError {
    return new SubscriptionError(
      '決済処理に失敗しました。お支払い方法を確認して再度お試しください。',
      SubscriptionErrorCode.PAYMENT_FAILED,
      { originalError: error }
    );
  }

  static cancellationFailed(error?: unknown): SubscriptionError {
    return new SubscriptionError(
      'サブスクリプションの解約に失敗しました。サポートにお問い合わせください。',
      SubscriptionErrorCode.CANCELLATION_FAILED,
      { originalError: error }
    );
  }

  static invalidStatus(status?: string): SubscriptionError {
    return new SubscriptionError(
      'サブスクリプションの状態が不正です。サポートにお問い合わせください。',
      SubscriptionErrorCode.INVALID_STATUS,
      { status }
    );
  }

  static networkError(error?: unknown): SubscriptionError {
    return new SubscriptionError(
      'ネットワークエラーが発生しました。インターネット接続を確認してください。',
      SubscriptionErrorCode.NETWORK_ERROR,
      { originalError: error }
    );
  }

  static authenticationFailed(error?: unknown): SubscriptionError {
    return new SubscriptionError(
      '認証に失敗しました。再度ログインしてください。',
      SubscriptionErrorCode.AUTHENTICATION_FAILED,
      { originalError: error }
    );
  }

  static accessDenied(): SubscriptionError {
    return new SubscriptionError(
      'この機能を利用するには有効なサブスクリプションが必要です。',
      SubscriptionErrorCode.ACCESS_DENIED
    );
  }

  static stripeError(stripeErrorCode?: string, error?: unknown): SubscriptionError {
    return new SubscriptionError(
      'お支払い処理でエラーが発生しました。しばらく経ってから再度お試しください。',
      SubscriptionErrorCode.STRIPE_ERROR,
      { stripeErrorCode, originalError: error }
    );
  }

  static webhookError(event?: string, error?: unknown): SubscriptionError {
    return new SubscriptionError(
      'サブスクリプション状態の同期に失敗しました。しばらく経ってから状態を確認してください。',
      SubscriptionErrorCode.WEBHOOK_ERROR,
      { event, originalError: error }
    );
  }
}