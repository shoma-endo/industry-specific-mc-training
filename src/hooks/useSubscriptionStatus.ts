'use client';

import { useState, useCallback } from 'react';
import type {
  ISubscriptionService,
  SubscriptionStatus as DomainSubscriptionStatus,
} from '@/domain/interfaces/ISubscriptionService';
import { SubscriptionError } from '@/domain/errors/SubscriptionError';
import type { SubscriptionHook } from '@/types/hooks';
import { env } from '@/env';

export type { SubscriptionHook };

export const useSubscriptionStatus = (
  subscriptionService: ISubscriptionService,
  getAccessToken: () => Promise<string>,
  isLoggedIn: boolean
): SubscriptionHook => {
  const [subscriptionStatus, setSubscriptionStatus] = useState<DomainSubscriptionStatus | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // エラークリア機能
  const clearError = useCallback(() => {
    setSubscriptionStatus((current) => {
      if (!current) {
        return current;
      }

      if (current.error === undefined) {
        return current;
      }

      return {
        ...current,
        error: undefined,
      };
    });
  }, []);

  // ✅ useEffectを排除 - 明示的な関数呼び出しベース
  const checkSubscription = useCallback(async () => {
    // Stripe無効時は無料アクセスを許可
    if (env.NEXT_PUBLIC_STRIPE_ENABLED !== 'true') {
      setSubscriptionStatus({
        hasActiveSubscription: true,
        requiresSubscription: false,
        error: undefined,
      });
      setHasInitialized(true);
      return;
    }

    if (!isLoggedIn) {
      setSubscriptionStatus({
        hasActiveSubscription: false,
        requiresSubscription: true,
        error: 'ログインが必要です',
      });
      return;
    }

    setIsLoading(true);
    clearError();

    try {
      const accessToken = await getAccessToken();
      const status = await subscriptionService.checkSubscription(accessToken);
      setSubscriptionStatus({
        ...status,
        error: status.error,
      });
      setHasInitialized(true);
    } catch (err) {
      console.error('Subscription check failed:', err);

      let errorMessage: string;
      if (err instanceof SubscriptionError) {
        errorMessage = err.userMessage;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      } else {
        errorMessage = 'サブスクリプションの確認に失敗しました';
      }

      setSubscriptionStatus({
        hasActiveSubscription: false,
        requiresSubscription: true,
        error: errorMessage,
      });
      setHasInitialized(true);
    } finally {
      setIsLoading(false);
    }
  }, [subscriptionService, getAccessToken, isLoggedIn, clearError]);

  const refreshSubscription = useCallback(async () => {
    await checkSubscription();
  }, [checkSubscription]);

  // ✅ 初期化状態を外部から制御可能に
  const initializeIfNeeded = useCallback(async () => {
    if (!hasInitialized && isLoggedIn) {
      await checkSubscription();
    }
  }, [hasInitialized, isLoggedIn, checkSubscription]);

  return {
    subscriptionStatus,
    isLoading,
    requiresSubscription: subscriptionStatus?.requiresSubscription ?? false,
    hasActiveSubscription: subscriptionStatus?.hasActiveSubscription ?? false,
    error: subscriptionStatus?.error ?? null,
    actions: {
      checkSubscription: initializeIfNeeded, // ✅ 自動初期化付き
      refreshSubscription,
      clearError,
    },
  };
};
