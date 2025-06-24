import { env } from '@/env';

export class LineTokenExpiredError extends Error {
  constructor(message?: string) {
    super(message || 'LINE access token has expired');
    this.name = 'LineTokenExpiredError';
  }
}

interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl: string;
  statusMessage?: string;
}

export class LineAuthService {
  private refreshToken = async (
    refreshToken: string
  ): Promise<{
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  }> => {
    try {
      const bodyParams = {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: env.NEXT_PUBLIC_LIFF_CHANNEL_ID,
        client_secret: env.LINE_CHANNEL_SECRET,
      };

      const response = await fetch('https://api.line.me/oauth2/v2.1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(bodyParams),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          `[LINE Token Refresh] ${data.error || 'Unknown error'}: ${data.error_description || 'No description'}`
        );
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`[LINE Token Refresh] ${error.message}`);
      }
      throw new Error('[LINE Token Refresh] Unknown error occurred');
    }
  };

  verifyLineTokenWithRefresh = async (
    accessToken: string,
    refreshTokenValue?: string
  ): Promise<{
    isValid: boolean;
    newAccessToken?: string;
    newRefreshToken?: string;
    needsReauth?: boolean;
  }> => {
    try {
      // まず現在のアクセストークンを検証
      await this.verifyLineToken(accessToken);
      return { isValid: true };
    } catch (error) {
      if (error instanceof LineTokenExpiredError && refreshTokenValue) {

        try {
          // リフレッシュトークンを使用して新しいアクセストークンを取得
          const refreshedTokens = await this.refreshToken(refreshTokenValue);

          return {
            isValid: true,
            newAccessToken: refreshedTokens.access_token,
            newRefreshToken: refreshedTokens.refresh_token || refreshTokenValue, // 新しいリフレッシュトークンがない場合は既存のものを保持
          };
        } catch (refreshError) {
          console.error('[LINE Auth] Token refresh failed:', refreshError);
          return {
            isValid: false,
            needsReauth: true,
          };
        }
      }

      // アクセストークンが無効でリフレッシュトークンもない場合
      return {
        isValid: false,
        needsReauth: true,
      };
    }
  };

  verifyLineToken = async (accessToken: string): Promise<void> => {
    try {
      const channelId = env.NEXT_PUBLIC_LIFF_CHANNEL_ID;
      const response = await fetch(
        `https://api.line.me/oauth2/v2.1/verify?access_token=${accessToken}`,
        {
          method: 'GET',
        }
      );

      // レスポンスボディをテキストとして取得してログ出力
      const responseText = await response.text();

      // 取得したテキストをJSONとしてパース
      let responseData: {
        client_id: string;
        expires_in: number;
        error?: string;
        error_description?: string;
      } | null = null;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        // JSONパースに失敗した場合のエラーハンドリング
        console.error('[LINE Token Verification] JSON.parse error:', e);
        // response.ok が false の場合、後続の処理でエラーがスローされるが、
        // response.ok が true で JSON パースに失敗した場合は、ここでエラーをスローする
        if (response.ok) {
          throw new Error(
            '[LINE Token Verification] Failed to parse JSON response from LINE Platform.'
          );
        }
      }

      if (!response.ok) {
        // responseDataがnull、または期待する形式でない場合も考慮
        const errorDescription = responseData?.error_description || responseText || 'Unknown error';
        const errorCode = responseData?.error || 'N/A';

        // トークン期限切れの場合は専用のエラーをthrow
        if (errorCode === 'invalid_request' && errorDescription.includes('access token expired')) {
          throw new LineTokenExpiredError(`${errorCode}: ${errorDescription}`);
        }

        throw new Error(`[LINE Token Verification] ${errorCode}: ${errorDescription}`);
      }
      // responseDataがnull、または期待する形式でない場合も考慮
      // response.ok が true の場合は responseData が null になることは基本的にないはずだが、念のためチェック
      if (!responseData || responseData.client_id !== channelId) {
        throw new Error(
          `Line client_id does not match:liffID : ${channelId}  client_id : ${responseData?.client_id}`
        );
      }
      if (responseData.expires_in < 0) {
        throw new LineTokenExpiredError(
          `Line access token is expired (expires_in: ${responseData.expires_in})`
        );
      }
    } catch (error) {
      if (error instanceof LineTokenExpiredError) {
        throw error;
      }
      if (error instanceof Error) {
        // 既に[LINE Token Verification]プレフィックスが付いている場合は重複を避ける
        if (error.message.includes('[LINE Token Verification]')) {
          throw error;
        }
        throw new Error(`[LINE Token Verification] ${error.message}`);
      }
      throw new Error('[LINE Token Verification] Unknown error occurred');
    }
  };

  getLineProfile = async (accessToken: string): Promise<LineProfile> => {
    // 開発モードかつアクセストークンが 'dummy-token' の場合は、ダミープロファイルを返す
    if (
      process.env.NODE_ENV === 'development' &&
      accessToken === 'dummy-token' // 固定文字列 'dummy-token' と比較
    ) {
      return {
        userId: 'dummy-user-id-from-fixed-token', // 識別可能なダミーID
        displayName: 'Dummy User (Fixed Token)',
        pictureUrl: '',
        statusMessage: 'This is a dummy user profile for development (fixed token).',
      };
    }

    try {
      const response = await fetch('https://api.line.me/v2/profile', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) {
        // エラーレスポンスの形式が不明なため、text()で取得して詳細をログに出力することを検討
        const errorText = await response.text();
        console.error('[LINE Profile Fetch] Error response text:', errorText);
        // error.messageがundefinedになるのを避けるため、エラーテキストを直接使うか、
        // より堅牢なエラーハンドリングを行う
        let errorMessage = `HTTP error ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = `[LINE Profile Fetch] ${errorJson.error || response.status}: ${errorJson.error_description || errorText}`;
        } catch (parseError) {
          console.error('[LINE Profile Fetch] JSON.parse error during error handling:', parseError);
          errorMessage = `[LINE Profile Fetch] ${response.status}: ${errorText}`;
        }
        throw new Error(errorMessage);
      }
      return response.json() as Promise<LineProfile>;
    } catch (error) {
      if (error instanceof Error) {
        // 既に[LINE Profile Fetch]プレフィックスが付いている場合は重複を避ける
        if (error.message.startsWith('[LINE Profile Fetch]')) {
          throw error;
        }
        throw new Error(`[LINE Profile Fetch] ${error.message}`);
      }
      throw new Error('[LINE Profile Fetch] Unknown error occurred');
    }
  };
}
