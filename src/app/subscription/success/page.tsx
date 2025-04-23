'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getCheckoutSessionDetails } from '@/server/handler/actions/subscription.actions';
import { useLiff } from '@/hooks/useLiff';

interface SessionDetails {
  id?: string;
  amount_total?: number | null;
  payment_status?: string;
}

export default function SubscriptionSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { getAccessToken } = useLiff();
  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // NOTE: getAccessTokenは依存配列から除外し、sessionIdの変更時のみ実行

  useEffect(() => {
    const fetchSessionDetails = async () => {
      if (!sessionId) {
        setError('セッションIDが見つかりません');
        setLoading(false);
        return;
      }

      try {
        const liffAccessToken = await getAccessToken();
        const result = await getCheckoutSessionDetails(sessionId, liffAccessToken);

        if (result.success && result.session) {
          setSessionDetails({
            id: result.session.id,
            amount_total: result.session.amount_total,
            payment_status: result.session.payment_status,
          });
        } else {
          setError(result.error || '詳細情報の取得に失敗しました');
        }
      } catch (err) {
        console.error('セッション詳細の取得中にエラーが発生しました:', err);
        setError('決済情報の取得中にエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchSessionDetails();
  }, [sessionId]);

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-lg mx-auto bg-white p-8 rounded-lg shadow-md text-center">
        <div className="text-green-500 text-6xl mb-4">✓</div>
        <h1 className="text-2xl font-bold mb-4">お支払いが完了しました</h1>
        <p className="text-gray-600 mb-6">
          サブスクリプションの登録が正常に完了しました。プレミアム機能をご利用いただけます。
        </p>

        {loading && <p className="text-gray-500 mb-4">決済情報を読み込み中...</p>}

        {error && <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded">{error}</div>}

        {sessionId && (
          <p className="text-sm text-gray-500 mb-6 break-all">
            注文番号:
            <br /> {sessionId}
          </p>
        )}

        {sessionDetails && (
          <div className="mb-6 text-left p-4 bg-gray-50 rounded">
            <h3 className="font-semibold mb-2">決済情報</h3>
            <p>
              合計金額: {sessionDetails.amount_total ? `${sessionDetails.amount_total}円` : '不明'}
            </p>
            <p>ステータス: {sessionDetails.payment_status || '不明'}</p>
          </div>
        )}

        <Link
          href="/"
          className="inline-block bg-blue-500 text-white py-2 px-6 rounded hover:bg-blue-600 transition-colors"
        >
          ホームに戻る
        </Link>
      </div>
    </div>
  );
}
