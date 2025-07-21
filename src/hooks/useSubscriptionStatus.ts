'use client';

import React, { useState, useCallback } from 'react';
import {
  ISubscriptionService,
  SubscriptionStatus,
  SubscriptionDetails,
} from '@/domain/interfaces/ISubscriptionService';
import { SubscriptionError } from '@/domain/errors/SubscriptionError';

export interface SubscriptionHook {
  subscriptionStatus: SubscriptionStatus | null;
  isLoading: boolean;
  requiresSubscription: boolean;
  hasActiveSubscription: boolean;
  subscriptionDetails: SubscriptionDetails | null;
  error: string | null;
  actions: {
    checkSubscription: () => Promise<void>;
    refreshSubscription: () => Promise<void>;
    clearError: () => void;
  };
}

export const useSubscriptionStatus = (
  subscriptionService: ISubscriptionService,
  getAccessToken: () => Promise<string>,
  isLoggedIn: boolean
): SubscriptionHook => {
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // エラークリア機能
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ✅ useEffectを排除 - 明示的な関数呼び出しベース
  const checkSubscription = useCallback(async () => {
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
      setSubscriptionStatus(status);
      setHasInitialized(true);
      setError(null);
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

      setError(errorMessage);
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

  // ✅ エラー処理を外部で実行（useCallback依存配列から除外）
  React.useEffect(() => {
    if (error && subscriptionStatus === null) {
      setSubscriptionStatus({
        hasActiveSubscription: false,
        requiresSubscription: true,
        error: error,
      });
      setHasInitialized(true);
    }
  }, [error, subscriptionStatus]);

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
    subscriptionDetails: subscriptionStatus?.subscription ?? null,
    error: error || subscriptionStatus?.error || null,
    actions: {
      checkSubscription: initializeIfNeeded, // ✅ 自動初期化付き
      refreshSubscription,
      clearError,
    },
  };
};
