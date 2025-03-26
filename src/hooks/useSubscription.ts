'use client';

import { useState } from 'react';
import { createSubscriptionSession } from '@/server/handler/actions/subscription.actions';
import { liff } from '@line/liff';
export function useSubscription() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startSubscription = async () => {
    setLoading(true);
    setError(null);

    try {
      await liff.ready;
      const liffAccessToken = await liff.getAccessToken();
      if (!liffAccessToken) {
        throw new Error('LIFFアクセストークンが取得できませんでした');
      }
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
