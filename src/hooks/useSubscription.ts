'use client';

import { useState } from 'react';
import { createSubscriptionSession } from '@/server/handler/actions/subscription.actions';
import { useLiff } from '@/hooks/useLiff';

export function useSubscription() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getAccessToken } = useLiff();

  const startSubscription = async () => {
    setLoading(true);
    setError(null);

    try {
      const liffAccessToken = await getAccessToken();
      // サブスクリプションセッションの作成
      const result = await createSubscriptionSession(liffAccessToken, window.location.origin);

      if (!result.success || !result.url) {
        setError(result.error || 'サブスクリプション作成に失敗しました');
        return;
      }

      // 成功した場合は、Stripeのチェックアウトページへリダイレクト
      window.location.href = result.url;
    } catch (err) {
      console.error('決済処理中にエラーが発生しました:', err);
      setError('決済処理中にエラーが発生しました。後でもう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  return {
    startSubscription,
    loading,
    error,
  };
}
