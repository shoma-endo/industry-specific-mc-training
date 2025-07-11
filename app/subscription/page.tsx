'use client';

import { useState, useEffect } from 'react';
import {
  createSubscriptionSession,
  getSubscriptionPriceDetails,
} from '@/server/handler/actions/subscription.actions';
import { Button } from '@/components/ui/button';
import { useLiff } from '@/hooks/useLiff';

// 価格情報の型定義
interface PriceDetails {
  id: string;
  unitAmount: number | null;
  currency: string;
  interval: string | undefined;
  intervalCount: number | undefined;
  productName: string;
  productDescription: string | null;
}

export default function SubscriptionPage() {
  const { getAccessToken } = useLiff();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceDetails, setPriceDetails] = useState<PriceDetails | null>(null);
  const [priceLoading, setPriceLoading] = useState(true);

  // NOTE: getAccessTokenを依存配列から除外し、マウント時に一度だけ実行

  useEffect(() => {
    const fetchPriceDetails = async () => {
      try {
        const liffAccessToken = await getAccessToken();
        const result = await getSubscriptionPriceDetails(liffAccessToken);
        if (result.success && result.priceDetails) {
          setPriceDetails(result.priceDetails);
        } else {
          console.error('価格情報の取得に失敗しました:', result.error);
        }
      } catch (error) {
        console.error('価格情報取得中にエラーが発生しました:', error);
      } finally {
        setPriceLoading(false);
      }
    };

    fetchPriceDetails();
  }, [getAccessToken]);

  // 金額を表示用にフォーマット
  const formatPrice = (amount: number | null, currency: string) => {
    if (amount === null) return '';

    // 日本円の場合
    if (currency === 'jpy') {
      return new Intl.NumberFormat('ja-JP', {
        style: 'currency',
        currency: 'JPY',
      }).format(amount);
    }

    // その他の通貨
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  // 課金周期をフォーマット
  const formatInterval = (interval: string | undefined, count: number | undefined) => {
    if (!interval) return '';

    const intervalMap: Record<string, string> = {
      day: '日',
      week: '週間',
      month: '月',
      year: '年',
    };

    const intervalText = intervalMap[interval] || interval;
    return count && count > 1 ? `${count}${intervalText}` : intervalText;
  };

  const startSubscription = async () => {
    setLoading(true);
    setError(null);

    try {
      // サブスクリプションセッションの作成
      const liffAccessToken = await getAccessToken();
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
        {priceLoading ? (
          <div className="text-center py-4">価格情報を読み込み中...</div>
        ) : (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">
              {priceDetails?.productName || 'プレミアムプラン'}
            </h2>
            <p className="text-gray-600 mb-4">
              {priceDetails?.unitAmount ? (
                <>
                  {formatInterval(priceDetails.interval, priceDetails.intervalCount)}額
                  {formatPrice(priceDetails.unitAmount, priceDetails.currency)}
                  （税込）で全ての機能にアクセスできます。
                </>
              ) : (
                '月額1,980円（税込）で全ての機能にアクセスできます。'
              )}
            </p>
            {priceDetails?.productDescription && (
              <p className="text-gray-600 mb-4">{priceDetails.productDescription}</p>
            )}
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
        )}

        {error && <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded">{error}</div>}

        <Button
          onClick={startSubscription}
          disabled={loading || priceLoading}
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
