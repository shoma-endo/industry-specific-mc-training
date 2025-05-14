import { env } from '@/env';

interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl: string;
  statusMessage?: string;
}

export class LineAuthService {
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
      console.log('[LINE Token Verification] Response Text:', responseText);

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
        throw new Error(`Line access token is expired: ${responseData.expires_in}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`[LINE Token Verification] ${error.message}`);
      }
      throw new Error('[LINE Token Verification] Unknown error occurred');
    }
  };

  getLineProfile = async (accessToken: string): Promise<LineProfile> => {
    try {
      const response = await fetch('https://api.line.me/v2/profile', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) {
        const data: { error_description: string; error: string } = await response.json();
        throw new Error(`[LINE Profile Fetch] ${data.error}: ${data.error_description}`);
      }
      return response.json() as Promise<LineProfile>;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`[LINE Profile Fetch] ${error.message}`);
      }
      throw new Error('[LINE Profile Fetch] Unknown error occurred');
    }
  };
}
