'use server';

import { SupabaseService } from '@/server/services/supabaseService';
import { getLiffTokensFromCookies } from '@/server/lib/auth-helpers';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { ERROR_MESSAGES } from '@/domain/errors/error-messages';
import { toUser } from '@/types/user';
import { isAdmin } from '@/authUtils';

/**
 * Google Ads 連携状態を取得
 */
export async function getGoogleAdsConnectionStatus(): Promise<{
  connected: boolean;
  googleAccountEmail: string | null;
  error?: string;
}> {
  try {
    const { accessToken, refreshToken } = await getLiffTokensFromCookies();

    if (!accessToken) {
      return {
        connected: false,
        googleAccountEmail: null,
        error: ERROR_MESSAGES.AUTH.NOT_LOGGED_IN,
      };
    }

    const authResult = await authMiddleware(accessToken, refreshToken);
    if (authResult.error || !authResult.userId) {
      return {
        connected: false,
        googleAccountEmail: null,
        error: ERROR_MESSAGES.AUTH.UNAUTHENTICATED,
      };
    }

    const supabaseService = new SupabaseService();

    // 管理者権限チェック（Google Ads 連携は審査完了まで管理者のみ）
    const userResult = await supabaseService.getUserById(authResult.userId);
    if (!userResult.success || !userResult.data) {
      return {
        connected: false,
        googleAccountEmail: null,
        error: ERROR_MESSAGES.USER.USER_INFO_NOT_FOUND,
      };
    }
    const user = toUser(userResult.data);
    if (!isAdmin(user.role)) {
      return {
        connected: false,
        googleAccountEmail: null,
        error: ERROR_MESSAGES.USER.ADMIN_REQUIRED,
      };
    }

    const credential = await supabaseService.getGoogleAdsCredential(authResult.userId);

    if (!credential) {
      return { connected: false, googleAccountEmail: null };
    }

    return {
      connected: true,
      googleAccountEmail: credential.googleAccountEmail,
    };
  } catch (error) {
    console.error('Error fetching Google Ads connection status:', error);
    return {
      connected: false,
      googleAccountEmail: null,
      error: ERROR_MESSAGES.GOOGLE_ADS.UNKNOWN_ERROR,
    };
  }
}
