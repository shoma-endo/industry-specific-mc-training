import { DomainError } from './BaseError';

export enum LiffErrorCode {
  INITIALIZATION_FAILED = 'LIFF_INITIALIZATION_FAILED',
  LOGIN_FAILED = 'LIFF_LOGIN_FAILED',
  TOKEN_EXPIRED = 'LIFF_TOKEN_EXPIRED',
  TOKEN_REFRESH_FAILED = 'LIFF_TOKEN_REFRESH_FAILED',
  PROFILE_FETCH_FAILED = 'LIFF_PROFILE_FETCH_FAILED',
  NETWORK_ERROR = 'LIFF_NETWORK_ERROR',
  INVALID_LIFF_ID = 'LIFF_INVALID_LIFF_ID',
  NOT_IN_LINE_CLIENT = 'LIFF_NOT_IN_LINE_CLIENT',
  LOGOUT_FAILED = 'LIFF_LOGOUT_FAILED',
}

export class LiffError extends DomainError {
  constructor(
    userMessage: string,
    code: LiffErrorCode,
    context?: Record<string, unknown>
  ) {
    super(userMessage, code, userMessage, context);
    this.name = 'LiffError';
  }

  static initializationFailed(error?: unknown): LiffError {
    return new LiffError(
      'LINEログインの初期化に失敗しました。ページを再読み込みしてください。',
      LiffErrorCode.INITIALIZATION_FAILED,
      { originalError: error }
    );
  }

  static loginFailed(error?: unknown): LiffError {
    return new LiffError(
      'LINEログインに失敗しました。もう一度お試しください。',
      LiffErrorCode.LOGIN_FAILED,
      { originalError: error }
    );
  }

  static tokenExpired(): LiffError {
    return new LiffError(
      'ログインセッションの有効期限が切れました。再度ログインしてください。',
      LiffErrorCode.TOKEN_EXPIRED
    );
  }

  static tokenRefreshFailed(error?: unknown): LiffError {
    return new LiffError(
      'アクセストークンの更新に失敗しました。再度ログインしてください。',
      LiffErrorCode.TOKEN_REFRESH_FAILED,
      { originalError: error }
    );
  }

  static profileFetchFailed(error?: unknown): LiffError {
    return new LiffError(
      'プロフィール情報の取得に失敗しました。',
      LiffErrorCode.PROFILE_FETCH_FAILED,
      { originalError: error }
    );
  }

  static networkError(error?: unknown): LiffError {
    return new LiffError(
      'ネットワークエラーが発生しました。インターネット接続を確認してください。',
      LiffErrorCode.NETWORK_ERROR,
      { originalError: error }
    );
  }

  static invalidLiffId(liffId?: string): LiffError {
    return new LiffError(
      'LIFF IDが正しく設定されていません。管理者にお問い合わせください。',
      LiffErrorCode.INVALID_LIFF_ID,
      { liffId }
    );
  }

  static notInLineClient(): LiffError {
    return new LiffError(
      'このアプリはLINEアプリ内でのみ利用できます。',
      LiffErrorCode.NOT_IN_LINE_CLIENT
    );
  }

  static logoutFailed(error?: unknown): LiffError {
    return new LiffError(
      'ログアウト処理に失敗しました。',
      LiffErrorCode.LOGOUT_FAILED,
      { originalError: error }
    );
  }
}