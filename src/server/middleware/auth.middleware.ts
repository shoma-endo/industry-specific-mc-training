'use server';

import { LineAuthService } from '@/server/services/lineAuthService';
import { userService } from '@/server/services/userService';

const lineAuthService = new LineAuthService();

export type AuthMiddlewareResult = {
  userId?: string;
  error?: string;
  requiresSubscription?: boolean;
};

/**
 * LINE認証とサブスクリプションチェックを行うミドルウェア
 */
export async function authMiddleware(liffAccessToken: string): Promise<AuthMiddlewareResult> {
  try {
    await lineAuthService.verifyLineToken(liffAccessToken);

    const hasSubscription = await userService.hasActiveSubscription(liffAccessToken);
    if (!hasSubscription) {
      return {
        error:
          '⚠️ この機能は有料会員のみご利用いただけます。サブスクリプションに登録してください。',
        requiresSubscription: true,
      };
    }

    const lineProfile = await lineAuthService.getLineProfile(liffAccessToken);
    return { userId: lineProfile.userId };
  } catch (error) {
    console.error('Authentication failed:', error);
    return { error: 'ユーザー認証に失敗しました。再ログインしてください。' };
  }
}
