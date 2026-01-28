'use server';

import { revalidatePath } from 'next/cache';
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
  customerId: string | null;
  error?: string;
}> {
  try {
    const { accessToken, refreshToken } = await getLiffTokensFromCookies();

    if (!accessToken) {
      return {
        connected: false,
        googleAccountEmail: null,
        customerId: null,
        error: ERROR_MESSAGES.AUTH.NOT_LOGGED_IN,
      };
    }

    const authResult = await authMiddleware(accessToken, refreshToken);
    if (authResult.error || !authResult.userId) {
      return {
        connected: false,
        googleAccountEmail: null,
        customerId: null,
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
        customerId: null,
        error: ERROR_MESSAGES.USER.USER_INFO_NOT_FOUND,
      };
    }
    const user = toUser(userResult.data);
    if (!isAdmin(user.role)) {
      return {
        connected: false,
        googleAccountEmail: null,
        customerId: null,
        error: ERROR_MESSAGES.USER.ADMIN_REQUIRED,
      };
    }

    const credential = await supabaseService.getGoogleAdsCredential(authResult.userId);

    if (!credential) {
      return { connected: false, googleAccountEmail: null, customerId: null };
    }

    return {
      connected: true,
      googleAccountEmail: credential.googleAccountEmail,
      customerId: credential.customerId,
    };
  } catch (error) {
    console.error('Error fetching Google Ads connection status:', error);
    return {
      connected: false,
      googleAccountEmail: null,
      customerId: null,
      error: ERROR_MESSAGES.GOOGLE_ADS.UNKNOWN_ERROR,
    };
  }
}

/**
 * Google Ads 連携を解除
 */
export async function disconnectGoogleAds() {
  try {
    const { accessToken, refreshToken } = await getLiffTokensFromCookies();

    if (!accessToken) {
      return { success: false, error: ERROR_MESSAGES.AUTH.NOT_LOGGED_IN };
    }

    const authResult = await authMiddleware(accessToken, refreshToken);
    if (authResult.error || !authResult.userId) {
      return { success: false, error: ERROR_MESSAGES.AUTH.UNAUTHENTICATED };
    }

    const supabaseService = new SupabaseService();

    // 管理者権限チェック（Google Ads 連携は審査完了まで管理者のみ）
    const userResult = await supabaseService.getUserById(authResult.userId);
    if (!userResult.success || !userResult.data) {
      return { success: false, error: ERROR_MESSAGES.USER.USER_INFO_NOT_FOUND };
    }
    const user = toUser(userResult.data);
    if (!isAdmin(user.role)) {
      return { success: false, error: ERROR_MESSAGES.USER.ADMIN_REQUIRED };
    }

    const deleteResult = await supabaseService.deleteGoogleAdsCredential(authResult.userId);
    if (!deleteResult.success) {
      console.error('[Google Ads Setup] disconnectGoogleAds: 削除失敗', {
        userMessage: deleteResult.error.userMessage,
        developerMessage: deleteResult.error.developerMessage,
        context: deleteResult.error.context,
      });
      return { success: false, error: ERROR_MESSAGES.GOOGLE_ADS.DISCONNECT_FAILED };
    }

    revalidatePath('/setup');
    revalidatePath('/setup/google-ads');
    return { success: true };
  } catch (error) {
    console.error('[Google Ads Setup] disconnect failed', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { success: false, error: ERROR_MESSAGES.GOOGLE_ADS.DISCONNECT_FAILED };
  }
}
