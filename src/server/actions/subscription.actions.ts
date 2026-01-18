'use server';

import { env } from '@/env';
import { StripeService } from '@/server/services/stripeService';
import { LineAuthService } from '@/server/services/lineAuthService';
import { userService } from '@/server/services/userService';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { isUnavailable } from '@/authUtils';
import type { EnsureAuthorizedUserOptions, EnsureAuthorizedUserResult } from '@/types/subscription';
import { ERROR_MESSAGES } from '@/domain/errors/error-messages';

// 遅延初期化でStripeServiceのインスタンスを取得
const getStripeService = () => new StripeService();
const getLineAuthService = () => new LineAuthService();

async function ensureAuthorizedUser(
  liffAccessToken: string,
  options?: EnsureAuthorizedUserOptions
): Promise<EnsureAuthorizedUserResult> {
  const authResult = await authMiddleware(liffAccessToken);

  if (
    authResult.error &&
    (!options?.allowRequiresSubscription || !authResult.requiresSubscription)
  ) {
    return {
      success: false,
      error: authResult.error,
      requiresSubscription: authResult.requiresSubscription,
    };
  }

  if (authResult.viewMode || (authResult.userDetails && authResult.userDetails.role === 'owner')) {
    return {
      success: false,
      error: ERROR_MESSAGES.USER.VIEW_MODE_OPERATION_NOT_ALLOWED,
    };
  }

  const user = authResult.userDetails ?? (await userService.getUserFromLiffToken(liffAccessToken));

  if (user && isUnavailable(user.role)) {
    return {
      success: false,
      error: ERROR_MESSAGES.USER.SERVICE_UNAVAILABLE,
    };
  }

  return {
    success: true,
    authResult,
    user,
  };
}

/**
 * ユーザーのサブスクリプション情報を取得するサーバーアクション
 */
export async function getUserSubscription(liffAccessToken: string) {
  try {
    // Stripe 機能が無効なら常に "加入不要" として扱う
    if (env.STRIPE_ENABLED !== 'true') {
      return {
        success: true,
        hasActiveSubscription: false,
        requiresSubscription: false,
      };
    }

    const authResult = await authMiddleware(liffAccessToken);

    // 認証エラーまたは未加入の場合はフラグをそのまま返す
    if (authResult.error || authResult.requiresSubscription) {
      return {
        success: true,
        hasActiveSubscription: false,
        error: authResult.error,
        requiresSubscription: authResult.requiresSubscription,
      };
    }

    // unavailableユーザーのサービス利用制限チェック
    const user =
      authResult.userDetails ?? (await userService.getUserFromLiffToken(liffAccessToken));
    if (user && isUnavailable(user.role)) {
      return {
        success: false,
        error: ERROR_MESSAGES.USER.SERVICE_UNAVAILABLE,
        hasActiveSubscription: false,
      };
    }
    const subscription = authResult.subscription;

    if (!subscription) {
      return {
        success: true,
        hasActiveSubscription: false,
        requiresSubscription: false,
      };
    }

    // 次回の請求日を取得
    const nextBillingDate = new Date(subscription.current_period_end * 1000);

    return {
      success: true,
      hasActiveSubscription: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        nextBillingDate: nextBillingDate.toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      userRole: user?.role ?? 'trial', // ✅ ユーザーロールを追加
    };
  } catch (error) {
    console.error('サブスクリプション情報取得エラー:', error);
    return {
      success: false,
      error: ERROR_MESSAGES.SUBSCRIPTION.INFO_FETCH_FAILED,
    };
  }
}

/**
 * サブスクリプション用のチェックアウトセッションを作成するサーバーアクション
 */
export async function createSubscriptionSession(liffAccessToken: string, host: string) {
  try {
    const authorization = await ensureAuthorizedUser(liffAccessToken, {
      allowRequiresSubscription: true,
    });
    if (!authorization.success) {
      return {
        success: false,
        error: authorization.error,
        requiresSubscription: authorization.requiresSubscription,
      };
    }

    const { user } = authorization;

    // トークンからユーザーIDを取得
    const lineProfile = await getLineAuthService().getLineProfile(liffAccessToken);
    const userId = lineProfile.userId;

    // リダイレクトURL
    const successUrl = `${host}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${host}/subscription/cancel`;
    if (!user) {
      return {
        success: false,
        error: ERROR_MESSAGES.USER.USER_INFO_FETCH_FAILED,
      };
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      customerId = await getStripeService().createCustomer(userId, lineProfile.displayName);
      await userService.updateStripeCustomerId(userId, customerId);
    }

    // Stripeチェックアウトセッション作成
    const { url, sessionId } = await getStripeService().createSubscriptionCheckout({
      priceId: env.STRIPE_PRICE_ID,
      customerId,
      successUrl,
      cancelUrl,
      metadata: {
        userId,
      },
    });

    if (!url) {
      return {
        success: false,
        error: ERROR_MESSAGES.SUBSCRIPTION.CHECKOUT_URL_CREATE_FAILED,
      };
    }

    return {
      success: true,
      url,
      sessionId,
    };
  } catch (error) {
    console.error('サブスクリプション決済セッション作成エラー:', error);
    return {
      success: false,
      error: ERROR_MESSAGES.SUBSCRIPTION.PAYMENT_PREP_ERROR,
    };
  }
}

/**
 * ユーザーの権限を確認するサーバーアクション
 */
export const checkUserRole = async (liffAccessToken: string) => {
  try {
    const user = await userService.getUserFromLiffToken(liffAccessToken);

    if (!user) {
      return {
        success: false,
        error: ERROR_MESSAGES.USER.USER_INFO_NOT_FOUND,
        role: 'trial' as const,
      };
    }

    // unavailableユーザーの場合は利用停止メッセージを返す
    if (isUnavailable(user.role)) {
      return {
        success: false,
        error: ERROR_MESSAGES.USER.SERVICE_UNAVAILABLE,
        role: user.role || ('trial' as const),
      };
    }

    return {
      success: true,
      role: user.role || ('trial' as const),
    };
  } catch (error) {
    console.error('権限チェックエラー:', error);
    return {
      success: false,
      error: ERROR_MESSAGES.USER.PERMISSION_ACQUISITION_FAILED,
      role: 'trial' as const,
    };
  }
};
