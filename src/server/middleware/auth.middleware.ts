'use server';

import { LineAuthService } from '@/server/services/lineAuthService';
import { userService } from '@/server/services/userService';
import { StripeService } from '@/server/services/stripeService';
import Stripe from 'stripe';

const lineAuthService = new LineAuthService();
const stripeService = new StripeService();

export type AuthMiddlewareResult = {
  lineUserId: string;
  userId: string;
  requiresSubscription: boolean;
  subscription: Stripe.Subscription | null;
  error?: string;
};

/**
 * LINE認証とサブスクリプションチェックを行うミドルウェア
 */
export async function authMiddleware(liffAccessToken: string): Promise<AuthMiddlewareResult> {
  try {
    await lineAuthService.verifyLineToken(liffAccessToken);
    const lineProfile = await lineAuthService.getLineProfile(liffAccessToken);
    const user = await userService.getUserFromLiffToken(liffAccessToken);
    if (!user) {
      return {
        error: 'ユーザー認証に失敗しました。再ログインしてください。',
        lineUserId: '',
        userId: '',
        requiresSubscription: true,
        subscription: null,
      };
    }

    if (!user.stripeSubscriptionId) {
      return {
        error: 'サブスクリプションが存在しません。',
        lineUserId: lineProfile.userId,
        userId: user.id,
        requiresSubscription: true,
        subscription: null,
      };
    }

    const subscription = await stripeService.getSubscription(user.stripeSubscriptionId);
    if (!subscription) {
      return {
        error: 'サブスクリプションが存在しません。',
        lineUserId: lineProfile.userId,
        userId: user.id,
        requiresSubscription: true,
        subscription: null,
      };
    }

    return {
      lineUserId: lineProfile.userId,
      userId: user.id,
      requiresSubscription: subscription.status !== 'active' && subscription.status !== 'trialing',
      subscription,
    };
  } catch (error) {
    console.error('Authentication failed:', error);
    return {
      error: 'ユーザー認証に失敗しました。再ログインしてください。',
      lineUserId: '',
      userId: '',
      requiresSubscription: false,
      subscription: null,
    };
  }
}
