'use client';

import { useState, useEffect } from 'react';
import { useLiff } from '@/hooks/useLiff';
import { Button } from '@/components/ui/button';
import {
  getUserSubscription,
  cancelUserSubscription,
  createCustomerPortalSession,
  resumeUserSubscription,
} from '@/server/handler/actions/subscription.actions';

// サブスクリプション情報の型定義
interface SubscriptionInfo {
  id: string;
  status: string;
  currentPeriodEnd: number;
  nextBillingDate: string;
  cancelAtPeriodEnd: boolean;
}

export default function MyPage() {
  const { profile, getAccessToken } = useLiff();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);

  // サブスクリプション情報を取得
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!profile) return;

      try {
        const liffAccessToken = await getAccessToken();
        const result = await getUserSubscription(liffAccessToken);

        if (result.success) {
          setHasActiveSubscription(result.hasActiveSubscription || false);
          if (result.subscription) {
            setSubscription(result.subscription);
          }
        } else {
          setError(result.error || 'サブスクリプション情報の取得に失敗しました');
        }
      } catch (error) {
        console.error('サブスクリプション情報取得エラー:', error);
        setError('サブスクリプション情報の取得中にエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [profile, getAccessToken]);

  // 支払い方法変更（Stripeポータルを開く）
  const handleUpdatePaymentMethod = async () => {
    setPaymentLoading(true);
    setError(null);

    try {
      const liffAccessToken = await getAccessToken();
      const result = await createCustomerPortalSession(
        window.location.origin + '/mypage',
        liffAccessToken
      );

      if (result.success && result.url) {
        // Stripeカスタマーポータルにリダイレクト
        window.location.href = result.url;
      } else {
        setError(result.error || '支払い方法変更の処理に失敗しました');
      }
    } catch (error) {
      console.error('支払い方法変更エラー:', error);
      setError('支払い方法の変更処理中にエラーが発生しました');
    } finally {
      setPaymentLoading(false);
    }
  };

  // サブスクリプション解約
  const handleCancelSubscription = async () => {
    if (!subscription) return;

    // 解約の確認
    if (
      !confirm(
        'サブスクリプションを解約してもよろしいですか？\n次回の更新日以降は自動更新されなくなりますが、現在の期間が終了するまではサービスをご利用いただけます。'
      )
    ) {
      return;
    }

    setCancelLoading(true);
    setError(null);

    try {
      // 注意：第2引数は開発環境で制御するためのもので、
      // 通常は false（期間終了時解約）を指定します
      const liffAccessToken = await getAccessToken();
      const result = await cancelUserSubscription(subscription.id, false, liffAccessToken);

      if (result.success) {
        // 最新のサブスクリプション情報を再取得
        const updatedResult = await getUserSubscription(liffAccessToken);
        if (updatedResult.success) {
          setHasActiveSubscription(updatedResult.hasActiveSubscription || false);
          setSubscription(updatedResult.subscription || null);
          alert(
            'サブスクリプションの解約が完了しました。\n次回の更新日以降は自動更新されなくなりますが、期間終了までは引き続きサービスをご利用いただけます。'
          );
        }
      } else {
        setError(result.error || 'サブスクリプションの解約に失敗しました');
      }
    } catch (error) {
      console.error('サブスクリプション解約エラー:', error);
      setError('サブスクリプションの解約処理中にエラーが発生しました');
    } finally {
      setCancelLoading(false);
    }
  };

  // 解約キャンセル（サブスクリプション継続）
  const handleResumeSubscription = async () => {
    if (!subscription) return;

    // 継続の確認
    if (
      !confirm(
        'サブスクリプションの解約をキャンセルし、継続しますか？\n次回の更新日以降も自動更新されるようになります。'
      )
    ) {
      return;
    }

    setResumeLoading(true);
    setError(null);

    try {
      const liffAccessToken = await getAccessToken();
      const result = await resumeUserSubscription(subscription.id, liffAccessToken);

      if (result.success) {
        // 最新のサブスクリプション情報を再取得
        const updatedResult = await getUserSubscription(liffAccessToken);
        if (updatedResult.success) {
          setHasActiveSubscription(updatedResult.hasActiveSubscription || false);
          setSubscription(updatedResult.subscription || null);
          alert('サブスクリプションを継続します。引き続きサービスをご利用いただけます。');
        }
      } else {
        setError(result.error || 'サブスクリプションの継続手続きに失敗しました');
      }
    } catch (error) {
      console.error('サブスクリプション継続エラー:', error);
      setError('サブスクリプションの継続処理中にエラーが発生しました');
    } finally {
      setResumeLoading(false);
    }
  };

  // 日付をフォーマット
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-center mb-6">マイページ</h1>

      {profile && (
        <div className="mb-8 flex items-center justify-center flex-col">
          {profile.pictureUrl && (
            <img
              src={profile.pictureUrl}
              alt={profile.displayName}
              className="w-20 h-20 rounded-full mb-3 border-2 border-gray-200"
            />
          )}
          <h2 className="text-xl font-semibold">{profile.displayName}</h2>
        </div>
      )}

      <div className="max-w-lg mx-auto bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">サブスクリプション情報</h2>

        {loading ? (
          <div className="text-center py-4">読み込み中...</div>
        ) : error ? (
          <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded">{error}</div>
        ) : !hasActiveSubscription ? (
          <div className="p-4 bg-gray-100 rounded mb-4">
            <p className="text-gray-600">有効なサブスクリプションがありません。</p>
            <Button
              className="mt-4 w-full"
              onClick={() => (window.location.href = '/subscription')}
            >
              サブスクリプションに登録する
            </Button>
          </div>
        ) : (
          <>
            <div className="p-4 bg-gray-100 rounded mb-4">
              <div className="mb-2">
                <span className="font-semibold">ステータス：</span>
                <span
                  className={`inline-block px-2 py-1 text-xs font-semibold rounded ml-2 ${(() => {
                    if (subscription?.cancelAtPeriodEnd) return 'bg-orange-100 text-orange-800';

                    switch (subscription?.status) {
                      case 'active':
                        return 'bg-green-100 text-green-800';
                      case 'past_due':
                        return 'bg-red-100 text-red-800';
                      case 'unpaid':
                        return 'bg-red-100 text-red-800';
                      case 'canceled':
                        return 'bg-gray-100 text-gray-800';
                      case 'incomplete':
                        return 'bg-yellow-100 text-yellow-800';
                      case 'incomplete_expired':
                        return 'bg-gray-100 text-gray-800';
                      case 'trialing':
                        return 'bg-blue-100 text-blue-800';
                      case 'paused':
                        return 'bg-purple-100 text-purple-800';
                      default:
                        return 'bg-gray-100 text-gray-800';
                    }
                  })()}`}
                >
                  {(() => {
                    if (subscription?.cancelAtPeriodEnd) return '解約予定';

                    switch (subscription?.status) {
                      case 'active':
                        return 'アクティブ';
                      case 'past_due':
                        return '支払い期限切れ';
                      case 'unpaid':
                        return '未払い';
                      case 'canceled':
                        return 'キャンセル済み';
                      case 'incomplete':
                        return '処理中';
                      case 'incomplete_expired':
                        return '処理失敗';
                      case 'trialing':
                        return 'トライアル中';
                      case 'paused':
                        return '一時停止中';
                      default:
                        return subscription?.status || '不明';
                    }
                  })()}
                </span>
              </div>

              <div className="mb-2">
                <span className="font-semibold">次回請求日：</span>
                <span className="ml-2">
                  {subscription?.nextBillingDate
                    ? formatDate(subscription.nextBillingDate)
                    : '情報なし'}
                </span>
              </div>

              {subscription?.cancelAtPeriodEnd && (
                <div className="mt-3 p-2 bg-yellow-50 rounded text-sm">
                  サービスは
                  {subscription.nextBillingDate
                    ? formatDate(subscription.nextBillingDate)
                    : '期間終了'}
                  まで引き続きご利用いただけます。
                </div>
              )}
            </div>

            <div className="space-y-3">
              {/* 有効なステータスの場合のみ支払い方法変更ボタンを表示 */}
              {(subscription?.status === 'active' ||
                subscription?.status === 'trialing' ||
                (subscription?.status === 'past_due' && !subscription?.cancelAtPeriodEnd)) && (
                <Button
                  className="w-full"
                  onClick={handleUpdatePaymentMethod}
                  disabled={paymentLoading}
                >
                  {paymentLoading ? '処理中...' : '支払い方法を変更する'}
                </Button>
              )}

              {/* 有効なステータスの場合のみ解約/継続ボタンを表示 */}
              {(subscription?.status === 'active' ||
                subscription?.status === 'trialing' ||
                (subscription?.status === 'past_due' && !subscription?.cancelAtPeriodEnd)) &&
                (subscription?.cancelAtPeriodEnd ? (
                  // 解約予定の場合は「解約をキャンセル」ボタンを表示
                  <Button
                    variant="outline"
                    className="w-full border-blue-300 text-blue-600 hover:bg-blue-50"
                    onClick={handleResumeSubscription}
                    disabled={resumeLoading}
                  >
                    {resumeLoading ? '処理中...' : 'サブスクリプションを継続する'}
                  </Button>
                ) : (
                  // アクティブな場合は「解約」ボタンを表示
                  <Button
                    variant="outline"
                    className="w-full border-red-300 text-red-600 hover:bg-red-50"
                    onClick={handleCancelSubscription}
                    disabled={cancelLoading}
                  >
                    {cancelLoading ? '処理中...' : 'サブスクリプションを解約する'}
                  </Button>
                ))}

              {/* 無効なステータスの場合のメッセージと新規登録ボタン */}
              {subscription?.status !== 'active' &&
                subscription?.status !== 'trialing' &&
                !(subscription?.status === 'past_due' && !subscription?.cancelAtPeriodEnd) && (
                  <div className="p-3 bg-gray-100 rounded text-sm text-gray-700 text-center">
                    {(() => {
                      switch (subscription?.status) {
                        case 'canceled':
                        case 'incomplete_expired':
                          return 'このサブスクリプションは既に終了しています。';
                        case 'past_due':
                          return 'お支払いが遅延しています。新しいサブスクリプションにご登録ください。';
                        case 'unpaid':
                          return 'お支払いが確認できません。新しいサブスクリプションにご登録ください。';
                        case 'incomplete':
                          return 'サブスクリプションの設定が完了していません。';
                        case 'paused':
                          return 'サブスクリプションは現在一時停止中です。';
                        default:
                          return 'サブスクリプションに問題があります。';
                      }
                    })()}
                    <Button
                      className="mt-3 w-full"
                      onClick={() => (window.location.href = '/subscription')}
                    >
                      新しいサブスクリプションに登録する
                    </Button>
                  </div>
                )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
