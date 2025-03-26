'use client';

import { useState } from 'react';
import { createSubscriptionSession } from '@/server/handler/actions/subscription.actions';
import { Button } from '@/components/ui/button';
import { liff } from '@line/liff';

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startSubscription = async () => {
    setLoading(true);
    setError(null);

    try {
      // サブスクリプションセッションの作成
      await liff.ready;
      const liffAccessToken = await liff.getAccessToken();
      if (!liffAccessToken) {
        setError('LINEアクセストークンが取得できませんでした');
        return;
      }
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

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-center mb-6">サブスクリプション登録</h1>

      <div className="max-w-lg mx-auto bg-white p-6 rounded-lg shadow-md">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">プレミアムプラン</h2>
          <p className="text-gray-600 mb-4">月額1,980円（税込）で全ての機能にアクセスできます。</p>
          <ul className="space-y-2 mb-4">
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>高度な分析機能</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>優先サポート</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>広告なし</span>
            </li>
          </ul>
        </div>

        {error && <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded">{error}</div>}

        <Button
          onClick={startSubscription}
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
        >
          {loading ? '処理中...' : 'サブスクリプションに登録する'}
        </Button>

        <p className="text-xs text-gray-500 mt-4">
          ※登録することで、利用規約とプライバシーポリシーに同意したことになります。
          いつでもキャンセル可能です。
        </p>
      </div>
    </div>
  );
}
