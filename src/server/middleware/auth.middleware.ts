'use server';

import { LineAuthService, LineTokenExpiredError } from '@/server/services/lineAuthService';
import { userService } from '@/server/services/userService';
import Stripe from 'stripe';
import { StripeService } from '@/server/services/stripeService';

export type AuthMiddlewareResult = {
  lineUserId: string;
  userId: string;
  requiresSubscription: boolean;
  subscription: Stripe.Subscription | null;
  error?: string;
};

// ダミーのアクセストークンリスト
const DUMMY_ACCESS_TOKENS = ['dummy-token', 'dummy-token-for-auth-check'];

/**
 * LINE認証とサブスクリプションチェックを行うミドルウェア
 */
export const authMiddleware = async (
  liffAccessToken?: string,
  refreshTokenValue?: string
): Promise<AuthMiddlewareResult> => {
  // ★★★ 開発時：特定のダミートークンの場合は検証をスキップ ★★★
  if (
    process.env.NODE_ENV === 'development' &&
    liffAccessToken &&
    DUMMY_ACCESS_TOKENS.includes(liffAccessToken)
  ) {
    console.warn(
      `[Auth Middleware] Development mode: Skipping LIFF token verification for dummy token: ${liffAccessToken}`
    );
    const dummyLineUserId = 'dev-dummy-line-id';
    const dummyAppUserId = 'dev-dummy-app-user-id';
    return {
      lineUserId: dummyLineUserId,
      userId: dummyAppUserId,
      requiresSubscription: false,
      subscription: null,
    };
  }
  // ★★★ ここまで ★★★

  if (!liffAccessToken) {
    return {
      error: 'Liff Access Token is required',
      lineUserId: '',
      userId: '',
      requiresSubscription: false,
      subscription: null,
    };
  }

  const lineAuthService = new LineAuthService();
  const stripeService = new StripeService();

  try {
    const verificationResult = await lineAuthService.verifyLineTokenWithRefresh(
      liffAccessToken,
      refreshTokenValue
    );

    if (!verificationResult.isValid || verificationResult.needsReauth) {
      return {
        error: 'Invalid or expired LINE token. Re-authentication required.',
        lineUserId: '',
        userId: '',
        requiresSubscription: true,
        subscription: null,
      };
    }

    const currentAccessToken = verificationResult.newAccessToken || liffAccessToken;
    const lineProfile = await lineAuthService.getLineProfile(currentAccessToken);

    if (!lineProfile || !lineProfile.userId) {
      return {
        error: 'Failed to get LINE user profile',
        lineUserId: '',
        userId: '',
        requiresSubscription: false,
        subscription: null,
      };
    }

    const user = await userService.getUserFromLiffToken(currentAccessToken);
    if (!user) {
      return {
        error: 'Application user not found for this LINE user.',
        lineUserId: lineProfile.userId,
        userId: '',
        requiresSubscription: false,
        subscription: null,
      };
    }

    const isSubscribed = await stripeService.checkSubscriptionStatus(user.id);

    let actualSubscription: Stripe.Subscription | null = null;
    if (user.stripeSubscriptionId) {
      actualSubscription = await stripeService.getSubscription(user.stripeSubscriptionId);
    }

    if (!isSubscribed) {
      return {
        lineUserId: lineProfile.userId,
        userId: user.id,
        error: 'Subscription required',
        requiresSubscription: true,
        subscription: actualSubscription,
      };
    }

    return {
      lineUserId: lineProfile.userId,
      userId: user.id,
      requiresSubscription: false,
      subscription: actualSubscription,
    };
  } catch (error) {
    console.error('[Auth Middleware] Error:', error);
    let errorMessage = '[Auth Middleware] Unknown error occurred';
    if (error instanceof LineTokenExpiredError) {
      errorMessage = 'LINE token has expired. Please re-authenticate.';
    } else if (error instanceof Error) {
      errorMessage = error.message.startsWith('[Auth Middleware]')
        ? error.message
        : `[Auth Middleware] ${error.message}`;
    }
    return {
      error: errorMessage,
      lineUserId: '',
      userId: '',
      requiresSubscription: false,
      subscription: null,
    };
  }
};
