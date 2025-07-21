'use client';

import { useState } from 'react';
import { createSubscriptionSession } from '@/server/handler/actions/subscription.actions';
import { useLiff } from '@/hooks/useLiff';
import { SubscriptionError } from '@/domain/errors/SubscriptionError';

export function useSubscription() {
  const { getAccessToken } = useLiff();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const startSubscription = async () => {
    setLoading(true);
    clearError();

    try {
      const liffAccessToken = await getAccessToken();
      // サブスクリプションセッションの作成
      const result = await createSubscriptionSession(liffAccessToken, window.location.origin);

      if (!result.success || !result.url) {
        throw SubscriptionError.creationFailed(
          new Error(result.error || 'サブスクリプション作成に失敗しました')
        );
      }

      // 成功した場合は、Stripeのチェックアウトページへリダイレクト
      window.location.href = result.url;
      setLoading(false);
      return result.url;
    } catch (err) {
      console.error('決済処理中にエラーが発生しました:', err);

      let errorMessage: string;
      if (err instanceof SubscriptionError) {
        errorMessage = err.userMessage;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      } else {
        errorMessage = 'サブスクリプション処理中にエラーが発生しました';
      }

      setError(errorMessage);
      setLoading(false);
      return null;
    }
  };

  return {
    startSubscription,
    loading,
    error,
    clearError,
  };
}
