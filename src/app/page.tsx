'use client';

import { useLiffContext } from '@/components/LiffProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { useState, useEffect } from 'react';
import {
  getUserSubscription,
  createSubscriptionSession,
  cancelUserSubscription,
  resumeUserSubscription,
  createCustomerPortalSession,
} from '@/server/handler/actions/subscription.actions';
import { Button } from '@/components/ui/button';

function ProfileDisplay() {
  const { profile, isLoading, isLoggedIn, logout } = useLiffContext();

  if (isLoading) {
    return <p className="text-center my-4">プロフィール読み込み中...</p>;
  }

  if (!isLoggedIn || !profile) {
    return <p className="text-center my-4">LINEアカウントでログインすると情報が表示されます</p>;
  }

  return (
    <Card className="w-full max-w-md mb-6">
      <CardHeader>
        <CardTitle className="text-xl text-center">LINEプロフィール</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        {profile.pictureUrl && (
          <Avatar className="h-26 w-26 mb-6">
            <img src={profile.pictureUrl} alt={profile.displayName} />
          </Avatar>
        )}
        <h3 className="text-xl font-bold mb-2">{profile.displayName}</h3>
        <p className="text-sm text-gray-600 mb-4">ユーザーID: {profile.userId}</p>
        <button
          onClick={logout}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm"
        >
          ログアウト
        </button>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { profile, getAccessToken } = useLiffContext();
  // サブスク関連ステート
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  interface SubscriptionInfo {
    id: string;
    status: string;
    currentPeriodEnd: number;
    nextBillingDate: string;
    cancelAtPeriodEnd: boolean;
  }
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);

  // 日付フォーマット
  const formatDate = (dateString: string) =>
    new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }).format(
      new Date(dateString)
    );

  // サブスク情報取得
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!profile) return;
      try {
        const token = await getAccessToken();
        const result = await getUserSubscription(token);
        if (result.success) {
          setHasActiveSubscription(result.hasActiveSubscription || false);
          if (result.subscription) setSubscription(result.subscription as SubscriptionInfo);
        } else {
          setError(result.error || 'サブスク取得エラー');
        }
      } catch {
        setError('サブスク取得中にエラー');
      } finally {
        setLoading(false);
      }
    };
    fetchSubscription();
  }, [profile]);

  // サブスクリプション登録
  const handleSubscribe = async () => {
    setActionLoading(true);
    try {
      const token = await getAccessToken();
      const { url } = await createSubscriptionSession(token, window.location.origin);
      if (url) window.location.href = url;
    } catch {
      setError('登録処理中にエラー');
    } finally {
      setActionLoading(false);
    }
  };

  // 支払い方法変更
  const handleUpdatePayment = async () => {
    setActionLoading(true);
    try {
      const token = await getAccessToken();
      const { url } = await createCustomerPortalSession(window.location.origin + '/', token);
      if (url) window.location.href = url;
    } catch {
      setError('支払方法変更エラー');
    } finally {
      setActionLoading(false);
    }
  };

  // サブスク解約
  const handleCancelSubscription = async () => {
    if (!subscription) return;
    if (!confirm('サブスクリプションを解約してもよろしいですか？')) return;
    setCancelLoading(true);
    try {
      const token = await getAccessToken();
      const result = await cancelUserSubscription(subscription.id, false, token);
      if (result.success) {
        const res = await getUserSubscription(token);
        setHasActiveSubscription(res.hasActiveSubscription || false);
        if (res.subscription) setSubscription(res.subscription as SubscriptionInfo);
      } else {
        setError(result.error || '解約に失敗しました');
      }
    } catch {
      setError('解約処理中にエラー');
    } finally {
      setCancelLoading(false);
    }
  };

  // サブスク継続
  const handleResumeSubscription = async () => {
    if (!subscription) return;
    if (!confirm('サブスクリプションの継続手続きを行いますか？')) return;
    setResumeLoading(true);
    try {
      const token = await getAccessToken();
      const result = await resumeUserSubscription(subscription.id, token);
      if (result.success) {
        const res = await getUserSubscription(token);
        setHasActiveSubscription(res.hasActiveSubscription || false);
        if (res.subscription) setSubscription(res.subscription as SubscriptionInfo);
      } else {
        setError(result.error || '継続に失敗しました');
      }
    } catch {
      setError('継続処理中にエラー');
    } finally {
      setResumeLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">業界特化MC養成講座</h1>

      <ProfileDisplay />

      {/* --- サブスクリプション情報カード --- */}
      <Card className="w-full max-w-md mb-6 mt-4">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-center">
            サブスクリプション情報
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">読み込み中...</div>
          ) : error ? (
            <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded">{error}</div>
          ) : !hasActiveSubscription ? (
            <div className="p-4 bg-gray-100 rounded">
              <p className="text-gray-600">有効なサブスクリプションがありません。</p>
              <Button className="mt-4 w-full" onClick={handleSubscribe} disabled={actionLoading}>
                {actionLoading ? '処理中...' : 'サブスクリプション登録'}
              </Button>
            </div>
          ) : subscription ? (
            <>
              {/* ステータス表示 */}
              <div className="p-4 bg-gray-100 rounded mb-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-semibold">ステータス：</span>
                  {(() => {
                    const status = subscription.status;
                    switch (status) {
                      case 'active':
                        return (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                            アクティブ
                          </span>
                        );
                      case 'trialing':
                        return (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                            トライアル中
                          </span>
                        );
                      case 'past_due':
                        return (
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded">
                            支払い期限切れ
                          </span>
                        );
                      case 'unpaid':
                        return (
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded">未払い</span>
                        );
                      case 'canceled':
                        return (
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded">
                            キャンセル済み
                          </span>
                        );
                      case 'incomplete':
                        return (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                            処理中
                          </span>
                        );
                      case 'incomplete_expired':
                        return (
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded">
                            処理失敗
                          </span>
                        );
                      case 'paused':
                        return (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded">
                            一時停止中
                          </span>
                        );
                      default:
                        return (
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded">不明</span>
                        );
                    }
                  })()}
                </div>
                {/* 次回請求日 */}
                <div className="mt-2">
                  <span className="font-semibold">次回請求日：</span>
                  <span className="ml-2">
                    {subscription.nextBillingDate
                      ? formatDate(subscription.nextBillingDate)
                      : '情報なし'}
                  </span>
                </div>
              </div>
              {/* 操作ボタン */}
              <div className="space-y-3">
                {/* 支払い方法変更 */}
                <Button className="w-full" onClick={handleUpdatePayment} disabled={actionLoading}>
                  {actionLoading ? '処理中...' : '支払い方法変更'}
                </Button>
                {/* 解約／継続ボタン */}
                {subscription.cancelAtPeriodEnd ? (
                  <Button
                    variant="outline"
                    className="w-full border-blue-300 text-blue-600 hover:bg-blue-50"
                    onClick={handleResumeSubscription}
                    disabled={resumeLoading}
                  >
                    {resumeLoading ? '処理中...' : 'サブスクリプションを継続する'}
                  </Button>
                ) : (
                  // 解約はアクティブまたはトライアル中にのみ表示
                  (subscription.status === 'active' || subscription.status === 'trialing') && (
                    <Button
                      variant="outline"
                      className="w-full border-red-300 text-red-600 hover:bg-red-50"
                      onClick={handleCancelSubscription}
                      disabled={cancelLoading}
                    >
                      {cancelLoading ? '処理中...' : 'サブスクリプションを解約する'}
                    </Button>
                  )
                )}
                {/* 無効ステータス時は再登録 */}
                {!(
                  subscription.status === 'active' ||
                  subscription.status === 'trialing' ||
                  (subscription.status === 'past_due' && !subscription.cancelAtPeriodEnd)
                ) && (
                  <div className="p-3 bg-gray-100 rounded text-sm text-gray-700 text-center">
                    {(() => {
                      const st = subscription.status;
                      switch (st) {
                        case 'canceled':
                        case 'incomplete_expired':
                          return 'このサブスクリプションは既に終了しています。';
                        case 'past_due':
                          return 'お支払いが遅延しています。新規登録してください。';
                        case 'unpaid':
                          return '未払いです。新規登録してください。';
                        case 'incomplete':
                          return 'サブスクリプション設定中です。';
                        case 'paused':
                          return '一時停止中です。';
                        default:
                          return 'サブスクリプションに問題があります。';
                      }
                    })()}
                    <Button className="mt-3 w-full" onClick={handleSubscribe}>
                      新規サブスクリプション登録
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
