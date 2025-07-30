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
  checkUserRole,
} from '@/server/handler/actions/subscription.actions';
import { updateUserFullName } from '@/server/handler/actions/user.actions';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Settings, Shield } from 'lucide-react';
import Link from 'next/link';
import { FullNameDialog } from '@/components/FullNameDialog';

interface SubscriptionInfo {
  id: string;
  status: string;
  currentPeriodEnd: number;
  nextBillingDate: string;
  cancelAtPeriodEnd: boolean;
}

const ProfileDisplay = () => {
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
            <Image src={profile.pictureUrl} alt={profile.displayName} width={104} height={104} />
          </Avatar>
        )}
        <h3 className="text-xl font-bold mb-2">{profile.displayName}</h3>
        <p className="text-sm text-gray-600 mb-4">ユーザーID: {profile.userId}</p>
        <button
          onClick={logout}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm"
          aria-label="ログアウト"
          tabIndex={0}
        >
          ログアウト
        </button>
      </CardContent>
    </Card>
  );
};

// 管理者向けカードコンポーネント（constパターン使用）
const AdminAccessCard = () => {
  const { getAccessToken, isLoggedIn, isLoading } = useLiffContext();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminRole = async () => {
      // LIFF初期化とログイン完了を待つ
      if (!isLoggedIn || isLoading) {
        setLoading(false);
        return;
      }

      try {
        const token = await getAccessToken();
        const result = await checkUserRole(token);

        if (result.success && result.role === 'admin') {
          setIsAdmin(true);
        }
      } catch (error) {
        console.error('管理者権限チェックエラー:', error);
        // エラーの場合は管理者ではないとして処理を続行
      } finally {
        setLoading(false);
      }
    };

    checkAdminRole();
  }, [getAccessToken, isLoggedIn, isLoading]);

  // Early return pattern - ログイン完了まで待つ
  if (isLoading || loading || !isLoggedIn || !isAdmin) {
    return null;
  }

  return (
    <Card className="w-full max-w-md mb-6 border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-center flex items-center justify-center gap-2">
          <Shield className="h-6 w-6 text-blue-600" />
          管理者機能
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm text-gray-600 text-center mb-4">管理者権限でログインしています</p>

          <Link href="/admin" className="block">
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700"
              aria-label="管理者ダッシュボードへ移動"
              tabIndex={0}
            >
              <Settings className="h-4 w-4 mr-2" />
              管理者ダッシュボード
            </Button>
          </Link>

          <Link href="/admin/prompts" className="block">
            <Button
              variant="outline"
              className="w-full border-blue-300 text-blue-700 hover:bg-blue-100"
              aria-label="プロンプト管理へ移動"
              tabIndex={0}
            >
              プロンプト管理
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default function Home() {
  const { profile, getAccessToken, isLoading, isLoggedIn, user } = useLiffContext();
  
  // サブスク関連ステート（descriptive naming）
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionInfo | null>(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);

  // フルネーム関連ステート
  const [showFullNameDialog, setShowFullNameDialog] = useState(false);

  // 日付フォーマット関数（constパターン）
  const formatDate = (dateString: string) =>
    new Intl.DateTimeFormat('ja-JP', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }).format(new Date(dateString));

  // フルネーム未入力チェック
  useEffect(() => {
    if (isLoggedIn && user && !user.fullName && !isLoading) {
      setShowFullNameDialog(true);
    }
  }, [isLoggedIn, user, isLoading]);

  // サブスク情報取得
  useEffect(() => {
    const fetchSubscriptionData = async () => {
      // LIFF初期化とログイン完了を待つ、フルネームダイアログが表示中は待機
      if (!profile || isLoading || !isLoggedIn || showFullNameDialog) {
        setSubscriptionLoading(false);
        return;
      }
      
      try {
        const token = await getAccessToken();
        const result = await getUserSubscription(token);
        
        if (result.success) {
          setHasActiveSubscription(result.hasActiveSubscription || false);
          if (result.subscription) {
            setSubscriptionData(result.subscription as SubscriptionInfo);
          }
        } else {
          setSubscriptionError(result.error || 'サブスク取得エラー');
        }
      } catch (error) {
        console.error('Subscription fetch error:', error);
        setSubscriptionError('サブスク取得中にエラー');
      } finally {
        setSubscriptionLoading(false);
      }
    };
    
    fetchSubscriptionData();
  }, [profile, getAccessToken, isLoading, isLoggedIn, showFullNameDialog]);

  // イベントハンドラー（handleプレフィックス）
  const handleSubscribe = async () => {
    setActionLoading(true);
    try {
      const token = await getAccessToken();
      const { url } = await createSubscriptionSession(token, window.location.origin);
      if (url) window.location.href = url;
    } catch {
      setSubscriptionError('登録処理中にエラー');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdatePayment = async () => {
    setActionLoading(true);
    try {
      const token = await getAccessToken();
      const { url } = await createCustomerPortalSession(window.location.origin + '/', token);
      if (url) window.location.href = url;
    } catch {
      setSubscriptionError('支払方法変更エラー');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscriptionData) return;
    if (!confirm('サブスクリプションを解約してもよろしいですか？')) return;
    
    setCancelLoading(true);
    try {
      const token = await getAccessToken();
      const result = await cancelUserSubscription(subscriptionData.id, false, token);
      
      if (result.success) {
        const res = await getUserSubscription(token);
        setHasActiveSubscription(res.hasActiveSubscription || false);
        if (res.subscription) {
          setSubscriptionData(res.subscription as SubscriptionInfo);
        }
      } else {
        setSubscriptionError(result.error || '解約に失敗しました');
      }
    } catch {
      setSubscriptionError('解約処理中にエラー');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleResumeSubscription = async () => {
    if (!subscriptionData) return;
    if (!confirm('サブスクリプションの継続手続きを行いますか？')) return;
    
    setResumeLoading(true);
    try {
      const token = await getAccessToken();
      const result = await resumeUserSubscription(subscriptionData.id, token);
      
      if (result.success) {
        const res = await getUserSubscription(token);
        setHasActiveSubscription(res.hasActiveSubscription || false);
        if (res.subscription) {
          setSubscriptionData(res.subscription as SubscriptionInfo);
        }
      } else {
        setSubscriptionError(result.error || '継続に失敗しました');
      }
    } catch {
      setSubscriptionError('継続処理中にエラー');
    } finally {
      setResumeLoading(false);
    }
  };

  const handleSaveFullName = async (fullName: string) => {
    try {
      const result = await updateUserFullName(fullName);
      if (result.success) {
        setShowFullNameDialog(false);
        window.location.reload();
      } else {
        throw new Error(result.error || 'フルネーム保存に失敗しました');
      }
    } catch (error) {
      console.error('フルネーム保存エラー:', error);
      throw error;
    }
  };

  const renderSubscriptionStatus = () => {
    if (!subscriptionData) return null;

    const status = subscriptionData.status;
    const statusConfig = {
      active: { label: 'アクティブ', className: 'px-2 py-1 bg-green-100 text-green-800 rounded' },
      trialing: { label: 'トライアル中', className: 'px-2 py-1 bg-blue-100 text-blue-800 rounded' },
      past_due: { label: '支払い期限切れ', className: 'px-2 py-1 bg-red-100 text-red-800 rounded' },
      unpaid: { label: '未払い', className: 'px-2 py-1 bg-red-100 text-red-800 rounded' },
      canceled: { label: 'キャンセル済み', className: 'px-2 py-1 bg-gray-100 text-gray-800 rounded' },
      incomplete: { label: '処理中', className: 'px-2 py-1 bg-yellow-100 text-yellow-800 rounded' },
      incomplete_expired: { label: '処理失敗', className: 'px-2 py-1 bg-gray-100 text-gray-800 rounded' },
      paused: { label: '一時停止中', className: 'px-2 py-1 bg-purple-100 text-purple-800 rounded' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || 
                   { label: '不明', className: 'px-2 py-1 bg-gray-100 text-gray-800 rounded' };

    return <span className={config.className}>{config.label}</span>;
  };

  return (
    <>
      <FullNameDialog open={showFullNameDialog} onSave={handleSaveFullName} />
      
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <h1 className="text-3xl font-bold mb-8">業界特化MC養成講座</h1>

        <ProfileDisplay />
        <AdminAccessCard />

      {/* サブスクリプション情報カード */}
      <Card className="w-full max-w-md mb-6 mt-4">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-center">
            サブスクリプション情報
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subscriptionLoading ? (
            <div className="text-center py-4">読み込み中...</div>
          ) : subscriptionError ? (
            <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded">
              {subscriptionError}
            </div>
          ) : !hasActiveSubscription ? (
            <div className="p-4 bg-gray-100 rounded">
              <p className="text-gray-600">有効なサブスクリプションがありません。</p>
              <Button 
                className="mt-4 w-full" 
                onClick={handleSubscribe} 
                disabled={actionLoading}
                aria-label="サブスクリプション登録"
                tabIndex={0}
              >
                {actionLoading ? '処理中...' : 'サブスクリプション登録'}
              </Button>
            </div>
          ) : subscriptionData ? (
            <>
              {/* ステータス表示 */}
              <div className="p-4 bg-gray-100 rounded mb-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-semibold">ステータス：</span>
                  {renderSubscriptionStatus()}
                </div>
                <div className="mt-2">
                  <span className="font-semibold">次回請求日：</span>
                  <span className="ml-2">
                    {subscriptionData.nextBillingDate
                      ? formatDate(subscriptionData.nextBillingDate)
                      : '情報なし'}
                  </span>
                </div>
              </div>

              {/* 操作ボタン */}
              <div className="space-y-3">
                <Button 
                  className="w-full" 
                  onClick={handleUpdatePayment} 
                  disabled={actionLoading}
                  aria-label="支払い方法変更"
                  tabIndex={0}
                >
                  {actionLoading ? '処理中...' : '支払い方法変更'}
                </Button>

                {subscriptionData.cancelAtPeriodEnd ? (
                  <Button
                    variant="outline"
                    className="w-full border-blue-300 text-blue-600 hover:bg-blue-50"
                    onClick={handleResumeSubscription}
                    disabled={resumeLoading}
                    aria-label="サブスクリプション継続"
                    tabIndex={0}
                  >
                    {resumeLoading ? '処理中...' : 'サブスクリプションを継続する'}
                  </Button>
                ) : (
                  (subscriptionData.status === 'active' || subscriptionData.status === 'trialing') && (
                    <Button
                      variant="outline"
                      className="w-full border-red-300 text-red-600 hover:bg-red-50"
                      onClick={handleCancelSubscription}
                      disabled={cancelLoading}
                      aria-label="サブスクリプション解約"
                      tabIndex={0}
                    >
                      {cancelLoading ? '処理中...' : 'サブスクリプションを解約する'}
                    </Button>
                  )
                )}

                {!(
                  subscriptionData.status === 'active' ||
                  subscriptionData.status === 'trialing' ||
                  (subscriptionData.status === 'past_due' && !subscriptionData.cancelAtPeriodEnd)
                ) && (
                  <div className="p-3 bg-gray-100 rounded text-sm text-gray-700 text-center">
                    {(() => {
                      const statusMessages = {
                        canceled: 'このサブスクリプションは既に終了しています。',
                        incomplete_expired: 'このサブスクリプションは既に終了しています。',
                        past_due: 'お支払いが遅延しています。新規登録してください。',
                        unpaid: '未払いです。新規登録してください。',
                        incomplete: 'サブスクリプション設定中です。',
                        paused: '一時停止中です。',
                      };
                      
                      return statusMessages[subscriptionData.status as keyof typeof statusMessages] || 
                             'サブスクリプションに問題があります。';
                    })()}
                    <Button 
                      className="mt-3 w-full" 
                      onClick={handleSubscribe}
                      aria-label="新規サブスクリプション登録"
                      tabIndex={0}
                    >
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
    </>
  );
}
