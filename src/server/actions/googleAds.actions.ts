'use server';

import { SupabaseService } from '@/server/services/supabaseService';
import { GoogleAdsService } from '@/server/services/googleAdsService';
import { getLiffTokensFromCookies } from '@/server/lib/auth-helpers';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { ERROR_MESSAGES } from '@/domain/errors/error-messages';
import { toUser } from '@/types/user';
import { isAdmin } from '@/authUtils';
import { getKeywordMetricsSchema } from '@/server/schemas/googleAds.schema';
import type { GoogleAdsKeywordMetric } from '@/types/googleAds.types';

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
    // 詳細ログはサーバー側のみに出力
    console.error('[getGoogleAdsConnectionStatus] Unexpected error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    // クライアントには共通メッセージのみ返却（内部情報を露出しない）
    return {
      connected: false,
      googleAccountEmail: null,
      error: ERROR_MESSAGES.GOOGLE_ADS.UNKNOWN_ERROR,
    };
  }
}

/**
 * キーワード指標取得の結果型
 */
interface FetchKeywordMetricsResult {
  success: boolean;
  data?: GoogleAdsKeywordMetric[];
  error?: string;
}

/**
 * キーワード指標を取得する Server Action
 *
 * @param customerId - Google Ads カスタマー ID（ハイフンなし 10桁）
 * @param startDate - 開始日（YYYY-MM-DD 形式）
 * @param endDate - 終了日（YYYY-MM-DD 形式）
 * @param campaignIds - キャンペーン ID でフィルタ（任意）
 */
export async function fetchKeywordMetrics(
  customerId: string,
  startDate: string,
  endDate: string,
  campaignIds?: string[]
): Promise<FetchKeywordMetricsResult> {
  try {
    // 入力バリデーション
    const parseResult = getKeywordMetricsSchema.safeParse({
      customerId,
      startDate,
      endDate,
      campaignIds,
    });

    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((issue) => issue.message).join(', ');
      return {
        success: false,
        error: ERROR_MESSAGES.GOOGLE_ADS.INVALID_INPUT(errors),
      };
    }

    // 認証チェック
    const { accessToken, refreshToken } = await getLiffTokensFromCookies();

    if (!accessToken) {
      return { success: false, error: ERROR_MESSAGES.AUTH.NOT_LOGGED_IN };
    }

    const authResult = await authMiddleware(accessToken, refreshToken);
    if (authResult.error || !authResult.userId) {
      return { success: false, error: ERROR_MESSAGES.AUTH.UNAUTHENTICATED };
    }

    const supabaseService = new SupabaseService();

    // 管理者権限チェック
    const userResult = await supabaseService.getUserById(authResult.userId);
    if (!userResult.success || !userResult.data) {
      return { success: false, error: ERROR_MESSAGES.USER.USER_INFO_NOT_FOUND };
    }
    const user = toUser(userResult.data);
    if (!isAdmin(user.role)) {
      return { success: false, error: ERROR_MESSAGES.USER.ADMIN_REQUIRED };
    }

    // Google Ads 認証情報を取得
    const credential = await supabaseService.getGoogleAdsCredential(authResult.userId);
    if (!credential) {
      return { success: false, error: ERROR_MESSAGES.GOOGLE_ADS.NOT_CONNECTED };
    }

    // アクセストークンの有効期限をチェック
    let googleAccessToken = credential.accessToken;
    const expiresAt = credential.accessTokenExpiresAt
      ? new Date(credential.accessTokenExpiresAt)
      : null;
    const now = new Date();

    // トークンが期限切れまたは期限間近（5分以内）の場合はリフレッシュ
    if (!googleAccessToken || !expiresAt || expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      if (!credential.refreshToken) {
        return { success: false, error: ERROR_MESSAGES.GOOGLE_ADS.AUTH_EXPIRED_OR_REVOKED };
      }

      try {
        const googleAdsService = new GoogleAdsService();
        const newTokens = await googleAdsService.refreshAccessToken(credential.refreshToken);
        googleAccessToken = newTokens.accessToken;

        // 新しいトークンを保存
        await supabaseService.saveGoogleAdsCredential(authResult.userId, {
          accessToken: newTokens.accessToken,
          refreshToken: credential.refreshToken,
          expiresIn: newTokens.expiresIn,
        });
      } catch (refreshError) {
        console.error('[fetchKeywordMetrics] Token refresh failed:', refreshError);
        return { success: false, error: ERROR_MESSAGES.GOOGLE_ADS.AUTH_EXPIRED_OR_REVOKED };
      }
    }

    if (!googleAccessToken) {
      return { success: false, error: ERROR_MESSAGES.GOOGLE_ADS.AUTH_EXPIRED_OR_REVOKED };
    }

    // キーワード指標を取得
    const googleAdsService = new GoogleAdsService();
    const result = await googleAdsService.getKeywordMetrics({
      accessToken: googleAccessToken,
      customerId: parseResult.data.customerId,
      startDate: parseResult.data.startDate,
      endDate: parseResult.data.endDate,
      ...(parseResult.data.campaignIds && { campaignIds: parseResult.data.campaignIds }),
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error ?? ERROR_MESSAGES.GOOGLE_ADS.KEYWORD_METRICS_FETCH_FAILED,
      };
    }

    return { success: true, data: result.data ?? [] };
  } catch (error) {
    // 詳細ログはサーバー側のみに出力
    console.error('[fetchKeywordMetrics] Unexpected error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    // クライアントには共通メッセージのみ返却（内部情報を露出しない）
    return {
      success: false,
      error: ERROR_MESSAGES.GOOGLE_ADS.UNKNOWN_ERROR,
    };
  }
}
