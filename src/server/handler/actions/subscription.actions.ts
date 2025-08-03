'use server';

import { env } from '@/env';
import { StripeService } from '@/server/services/stripeService';
import { LineAuthService } from '@/server/services/lineAuthService';
import { userService } from '@/server/services/userService';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { isUnavailable, canUseServices } from '@/lib/auth-utils';

// 遅延初期化でStripeServiceのインスタンスを取得
const getStripeService = () => new StripeService();
const getLineAuthService = () => new LineAuthService();

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
    const user = await userService.getUserFromLiffToken(liffAccessToken);
    if (user && isUnavailable(user.role)) {
      return {
        success: false,
        error: 'サービスの利用が停止されています',
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
    };
  } catch (error) {
    console.error('サブスクリプション情報取得エラー:', error);
    return {
      success: false,
      error: 'サブスクリプション情報の取得に失敗しました',
    };
  }
}

/**
 * サブスクリプションを解約するサーバーアクション
 * @param subscriptionId サブスクリプションID
 * @param immediate 即時解約するかどうか（trueなら即時解約、falseなら期間終了時解約）
 */
export async function cancelUserSubscription(
  subscriptionId: string,
  immediate: boolean = false,
  liffAccessToken: string
) {
  try {
    const authResult = await authMiddleware(liffAccessToken);
    if (authResult.error) {
      return {
        success: false,
        error: authResult.error,
        requiresSubscription: authResult.requiresSubscription,
      };
    }

    // unavailableユーザーのサービス利用制限チェック
    const user = await userService.getUserFromLiffToken(liffAccessToken);
    if (user && !canUseServices(user.role)) {
      return {
        success: false,
        error: 'サービスの利用が停止されています',
      };
    }

    await getStripeService().cancelSubscription(subscriptionId, immediate);

    return {
      success: true,
      immediate,
    };
  } catch (error) {
    console.error('サブスクリプション解約エラー:', error);
    return {
      success: false,
      error: 'サブスクリプションの解約に失敗しました',
    };
  }
}

/**
 * 解約予定のサブスクリプションを継続する（解約をキャンセル）サーバーアクション
 * @param subscriptionId サブスクリプションID
 */
export async function resumeUserSubscription(subscriptionId: string, liffAccessToken: string) {
  try {
    const authResult = await authMiddleware(liffAccessToken);
    if (authResult.error) {
      return {
        success: false,
        error: authResult.error,
        requiresSubscription: authResult.requiresSubscription,
      };
    }

    // unavailableユーザーのサービス利用制限チェック
    const user = await userService.getUserFromLiffToken(liffAccessToken);
    if (user && !canUseServices(user.role)) {
      return {
        success: false,
        error: 'サービスの利用が停止されています',
      };
    }

    await getStripeService().resumeSubscription(subscriptionId);

    return {
      success: true,
    };
  } catch (error) {
    console.error('サブスクリプション継続エラー:', error);
    return {
      success: false,
      error: 'サブスクリプションの継続手続きに失敗しました',
    };
  }
}

/**
 * カスタマーポータルセッションを作成するサーバーアクション（支払い方法変更など）
 */
export async function createCustomerPortalSession(returnUrl: string, liffAccessToken: string) {
  try {
    const authResult = await authMiddleware(liffAccessToken);
    if (authResult.error) {
      return {
        success: false,
        error: authResult.error,
        requiresSubscription: authResult.requiresSubscription,
      };
    }

    // unavailableユーザーのサービス利用制限チェック
    const user = await userService.getUserFromLiffToken(liffAccessToken);
    if (user && !canUseServices(user.role)) {
      return {
        success: false,
        error: 'サービスの利用が停止されています',
      };
    }

    if (!user || !user.stripeCustomerId) {
      return {
        success: false,
        error: 'サブスクリプション情報が見つかりません',
      };
    }

    const { url } = await getStripeService().createCustomerPortalSession(
      user.stripeCustomerId,
      returnUrl
    );

    return {
      success: true,
      url,
    };
  } catch (error) {
    console.error('カスタマーポータルセッション作成エラー:', error);
    return {
      success: false,
      error: 'カスタマーポータルの作成に失敗しました',
    };
  }
}

/**
 * サブスクリプションの価格情報を取得するサーバーアクション
 */
export async function getSubscriptionPriceDetails(liffAccessToken: string) {
  try {
    const authResult = await authMiddleware(liffAccessToken);
    if (authResult.error) {
      return {
        success: false,
        error: authResult.error,
      };
    }

    // unavailableユーザーのサービス利用制限チェック
    const user = await userService.getUserFromLiffToken(liffAccessToken);
    if (user && !canUseServices(user.role)) {
      return {
        success: false,
        error: 'サービスの利用が停止されています',
      };
    }

    const priceId = env.STRIPE_PRICE_ID;
    const priceDetails = await getStripeService().getPriceDetails(priceId);

    return {
      success: true,
      priceDetails,
    };
  } catch (error) {
    console.error('サブスクリプション価格情報取得エラー:', error);
    return {
      success: false,
      error: '価格情報の取得に失敗しました',
    };
  }
}

/**
 * サブスクリプション用のチェックアウトセッションを作成するサーバーアクション
 */
export async function createSubscriptionSession(liffAccessToken: string, host: string) {
  try {
    const authResult = await authMiddleware(liffAccessToken);
    if (authResult.error && !authResult.requiresSubscription) {
      return {
        success: false,
        error: authResult.error,
      };
    }

    // unavailableユーザーのサービス利用制限チェック
    const user = await userService.getUserFromLiffToken(liffAccessToken);
    if (user && !canUseServices(user.role)) {
      return {
        success: false,
        error: 'サービスの利用が停止されています',
      };
    }

    // トークンからユーザーIDを取得
    const lineProfile = await getLineAuthService().getLineProfile(liffAccessToken);
    const userId = lineProfile.userId;

    // リダイレクトURL
    const successUrl = `${host}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${host}/subscription/cancel`;
    if (!user) {
      return {
        success: false,
        error: 'ユーザー情報の取得に失敗しました',
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
        error: 'チェックアウトURLの作成に失敗しました',
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
      error: '決済処理の準備中にエラーが発生しました',
    };
  }
}

/**
 * Stripeのチェックアウトセッション詳細を取得するサーバーアクション
 */
export async function getCheckoutSessionDetails(sessionId: string, liffAccessToken: string) {
  try {
    const authResult = await authMiddleware(liffAccessToken);
    if (authResult.error) {
      return {
        success: false,
        error: authResult.error,
      };
    }

    // unavailableユーザーのサービス利用制限チェック
    const user = await userService.getUserFromLiffToken(liffAccessToken);
    if (user && !canUseServices(user.role)) {
      return {
        success: false,
        error: 'サービスの利用が停止されています',
      };
    }

    const session = await getStripeService().getCheckoutSession(sessionId);

    if (session && session.subscription && authResult.lineUserId) {
      const subscriptionId = session.subscription as string;

      await userService.updateStripeSubscriptionId(authResult.lineUserId, subscriptionId);
    }

    return {
      success: true,
      session: {
        id: session.id,
        amount_total: session.amount_total,
        payment_status: session.payment_status,
      },
    };
  } catch (error) {
    console.error('チェックアウトセッション取得エラー:', error);
    return {
      success: false,
      error: 'セッション情報の取得に失敗しました',
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
        error: 'ユーザー情報が見つかりません',
        role: 'user' as const,
      };
    }

    // unavailableユーザーの場合は利用停止メッセージを返す
    if (isUnavailable(user.role)) {
      return {
        success: false,
        error: 'サービスの利用が停止されています',
        role: user.role || ('user' as const),
      };
    }

    return {
      success: true,
      role: user.role || ('user' as const),
    };
  } catch (error) {
    console.error('権限チェックエラー:', error);
    return {
      success: false,
      error: '権限の確認に失敗しました',
      role: 'user' as const,
    };
  }
};
