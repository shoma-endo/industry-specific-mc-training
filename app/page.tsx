'use client';

import { useLiffContext } from '@/components/LiffProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { useState, useEffect, useMemo } from 'react';
import {
  createSubscriptionSession,
  cancelUserSubscription,
  resumeUserSubscription,
  createCustomerPortalSession,
} from '@/server/handler/actions/subscription.actions';
import { updateUserFullName } from '@/server/handler/actions/user.actions';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Settings, Shield, List } from 'lucide-react';
import Link from 'next/link';
import { FullNameDialog } from '@/components/FullNameDialog';
import { env } from '@/env';
import { SubscriptionService } from '@/domain/services/SubscriptionService';
import { ErrorAlert } from '@/components/ErrorAlert';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import type { SubscriptionDetails as DomainSubscriptionDetails } from '@/domain/interfaces/ISubscriptionService';
import { hasPaidFeatureAccess } from '@/types/user';

const STRIPE_ENABLED = env.NEXT_PUBLIC_STRIPE_ENABLED === 'true'; // サブスクリプション機能が有効かどうか

const ProfileDisplay = () => {
  const { profile, isLoading, isLoggedIn, logout } = useLiffContext();

  if (isLoading || !isLoggedIn || !profile) {
    return null;
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
interface AdminAccessCardProps {
  isAdmin: boolean;
  isLoggedIn: boolean;
  isLoading: boolean;
}

const AdminAccessCard = ({ isAdmin, isLoggedIn, isLoading }: AdminAccessCardProps) => {
  if (isLoading || !isLoggedIn || !isAdmin) {
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

          <Button
            asChild
            className="w-full bg-blue-600 hover:bg-blue-700"
            aria-label="管理者ダッシュボードへ移動"
            tabIndex={0}
          >
            <Link href="/admin">
              <Settings className="h-4 w-4 mr-2" />
              管理者ダッシュボード
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default function Home() {
  const { getAccessToken, isLoading, isLoggedIn, user } = useLiffContext();
  const subscriptionService = useMemo(() => new SubscriptionService(), []);
  const subscription = useSubscriptionStatus(subscriptionService, getAccessToken, isLoggedIn);
  const userRole = user?.role ?? null;
  const isRoleLoading = isLoggedIn && !user;
  const [pendingAction, setPendingAction] = useState<
    null | 'subscribe' | 'updatePayment' | 'cancel' | 'resume'
  >(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const subscriptionLoading = subscription.isLoading;
  const subscriptionInitialized = subscription.hasInitialized;
  const activeSubscription: DomainSubscriptionDetails | null =
    (subscription.subscriptionStatus?.subscription as DomainSubscriptionDetails | undefined) ?? null;
  const hasActiveSubscription = subscription.hasActiveSubscription;
  const subscriptionError = operationError ?? subscription.error;

  // フルネーム関連ステート
  const [showFullNameDialog, setShowFullNameDialog] = useState(false);

  const isAdmin = userRole === 'admin';
  const hasManagementAccess = hasPaidFeatureAccess(userRole);

  // 日付フォーマット関数（constパターン）
  const formatDate = (value: Date | string | null | undefined) => {
    if (!value) {
      return '情報なし';
    }

    const date = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  // フルネーム未入力チェック
  useEffect(() => {
    if (isLoggedIn && user && !user.fullName && !isLoading) {
      setShowFullNameDialog(true);
    }
  }, [isLoggedIn, user, isLoading]);

  const {
    checkSubscription: initializeSubscription,
    refreshSubscription,
    clearError,
    resetInitialization,
  } = subscription.actions;

  useEffect(() => {
    if (!isLoggedIn) {
      resetInitialization();
    }
  }, [isLoggedIn, resetInitialization]);

  // イベントハンドラー（handleプレフィックス）
  const handleSubscribe = async () => {
    setPendingAction('subscribe');
    setOperationError(null);
    clearError();
    try {
      const token = await getAccessToken();
      const { url } = await createSubscriptionSession(token, window.location.origin);
      if (url) window.location.href = url;
    } catch {
      setOperationError('登録処理中にエラー');
    } finally {
      setPendingAction(null);
    }
  };

  const handleUpdatePayment = async () => {
    setPendingAction('updatePayment');
    setOperationError(null);
    clearError();
    try {
      const token = await getAccessToken();
      const { url } = await createCustomerPortalSession(window.location.origin + '/', token);
      if (url) window.location.href = url;
    } catch {
      setOperationError('支払方法変更エラー');
    } finally {
      setPendingAction(null);
    }
  };

  const handleInitializeSubscription = () => {
    setOperationError(null);
    clearError();
    void initializeSubscription();
  };

  const handleCancelSubscription = async () => {
    if (!activeSubscription) return;
    if (!confirm('サブスクリプションを解約してもよろしいですか？')) return;

    setPendingAction('cancel');
    setOperationError(null);
    clearError();
    try {
      const token = await getAccessToken();
      const result = await cancelUserSubscription(activeSubscription.id, false, token);

      if (result.success) {
        await refreshSubscription();
      } else {
        setOperationError(result.error || '解約に失敗しました');
      }
    } catch {
      setOperationError('解約処理中にエラー');
    } finally {
      setPendingAction(null);
    }
  };

  const handleResumeSubscription = async () => {
    if (!activeSubscription) return;
    if (!confirm('サブスクリプションの継続手続きを行いますか？')) return;

    setPendingAction('resume');
    setOperationError(null);
    clearError();
    try {
      const token = await getAccessToken();
      const result = await resumeUserSubscription(activeSubscription.id, token);

      if (result.success) {
        await refreshSubscription();
      } else {
        setOperationError(result.error || '継続に失敗しました');
      }
    } catch {
      setOperationError('継続処理中にエラー');
    } finally {
      setPendingAction(null);
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
    if (!activeSubscription) return null;

    const status = activeSubscription.status;
    const statusConfig: Record<string, { label: string; className: string }> = {
      active: { label: 'アクティブ', className: 'px-2 py-1 bg-green-100 text-green-800 rounded' },
      trialing: { label: 'トライアル中', className: 'px-2 py-1 bg-blue-100 text-blue-800 rounded' },
      past_due: { label: '支払い期限切れ', className: 'px-2 py-1 bg-red-100 text-red-800 rounded' },
      canceled: {
        label: 'キャンセル済み',
        className: 'px-2 py-1 bg-gray-100 text-gray-800 rounded',
      },
    };

    const config = statusConfig[status] || {
      label: '不明',
      className: 'px-2 py-1 bg-gray-100 text-gray-800 rounded',
    };

    return <span className={config.className}>{config.label}</span>;
  };

  return (
    <>
      <FullNameDialog open={showFullNameDialog} onSave={handleSaveFullName} />

      {(!isLoading && isLoggedIn) && (
        <div className="flex flex-col items-center justify-center min-h-screen p-8">
          <h1 className="text-3xl font-bold mb-8">GrowMate</h1>

          <ProfileDisplay />
          <AdminAccessCard
            isAdmin={isAdmin}
            isLoggedIn={isLoggedIn}
            isLoading={isLoading || isRoleLoading}
          />

          {/* 有料/管理者向け 設定ページ導線 */}
          {isLoggedIn && hasManagementAccess && !isRoleLoading && (
          <Card className="w-full max-w-md mb-6">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-center flex items-center justify-center gap-2 -ml-2">
                <Settings className="h-5 w-5" />
                設定
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 text-center mb-4">
                WordPressやGoogle Search Consoleの連携設定はこちらから
              </p>
              <Button asChild className="w-full" aria-label="設定ページへ移動" tabIndex={0}>
                <Link href="/setup">設定を開く</Link>
              </Button>
            </CardContent>
          </Card>
          )}

          {/* 有料/管理者向け コンテンツ一覧導線 */}
          {isLoggedIn && hasManagementAccess && !isRoleLoading && (
          <Card className="w-full max-w-md mb-6">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-center flex items-center justify-center gap-2 -ml-2">
                <List className="h-5 w-5" />
                コンテンツ一覧
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 text-center mb-4">
                WordPressとGoogleSearchConsoleのメタ情報を一覧表示します
              </p>
              <Button asChild className="w-full" aria-label="コンテンツ一覧へ移動" tabIndex={0}>
                <Link href="/analytics">一覧を開く</Link>
              </Button>
            </CardContent>
          </Card>
          )}

          {/* サブスクリプション情報カード */}
          {STRIPE_ENABLED && (
          <Card className="w-full max-w-md mb-6 mt-4">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-center">
                サブスクリプション情報
              </CardTitle>
            </CardHeader>
            <CardContent>
              {subscriptionLoading ? (
                <div className="text-center py-4">読み込み中...</div>
              ) : !subscriptionInitialized ? (
                <div className="p-4 bg-gray-100 rounded">
                  <p className="text-gray-600">
                    サブスクリプション情報の取得には少し時間がかかる場合があります。必要なときに読み込んでください。
                  </p>
                  <Button
                    className="mt-4 w-full"
                    onClick={handleInitializeSubscription}
                    disabled={subscriptionLoading}
                    aria-label="サブスクリプション情報を読み込む"
                    tabIndex={0}
                  >
                    情報を読み込む
                  </Button>
                </div>
              ) : subscriptionError ? (
                <div className="mb-4">
                  <ErrorAlert error={subscriptionError} />
                </div>
              ) : !hasActiveSubscription ? (
                <div className="p-4 bg-gray-100 rounded">
                  <p className="text-gray-600">有効なサブスクリプションがありません。</p>
                  <Button
                    className="mt-4 w-full"
                    onClick={handleSubscribe}
                    disabled={pendingAction !== null}
                    aria-label="サブスクリプション登録"
                    tabIndex={0}
                  >
                    {pendingAction === 'subscribe' ? '処理中...' : 'サブスクリプション登録'}
                  </Button>
                </div>
              ) : activeSubscription && hasActiveSubscription ? (
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
                        {formatDate(activeSubscription.currentPeriodEnd)}
                      </span>
                    </div>
                  </div>

                  {/* 操作ボタン */}
                  <div className="space-y-3">
                    <Button
                      className="w-full"
                      onClick={handleUpdatePayment}
                      disabled={pendingAction !== null}
                      aria-label="支払い方法変更"
                      tabIndex={0}
                    >
                      {pendingAction === 'updatePayment' ? '処理中...' : '支払い方法変更'}
                    </Button>

                    {activeSubscription.cancelAtPeriodEnd ? (
                      <Button
                        variant="outline"
                        className="w-full border-blue-300 text-blue-600 hover:bg-blue-50"
                        onClick={handleResumeSubscription}
                        disabled={pendingAction !== null}
                        aria-label="サブスクリプション継続"
                        tabIndex={0}
                      >
                        {pendingAction === 'resume' ? '処理中...' : 'サブスクリプションを継続する'}
                      </Button>
                    ) : (
                      (activeSubscription.status === 'active' ||
                        activeSubscription.status === 'trialing') && (
                        <Button
                          variant="outline"
                          className="w-full border-red-300 text-red-600 hover:bg-red-50"
                          onClick={handleCancelSubscription}
                          disabled={pendingAction !== null}
                          aria-label="サブスクリプション解約"
                          tabIndex={0}
                        >
                          {pendingAction === 'cancel' ? '処理中...' : 'サブスクリプションを解約する'}
                        </Button>
                      )
                    )}

                    {!(
                      activeSubscription.status === 'active' ||
                      activeSubscription.status === 'trialing' ||
                      (activeSubscription.status === 'past_due' &&
                        !activeSubscription.cancelAtPeriodEnd)
                    ) && (
                      <div className="p-3 bg-gray-100 rounded text-sm text-gray-700 text-center">
                        {(() => {
                          const statusMessages = {
                            canceled: 'このサブスクリプションは既に終了しています。',
                            past_due: 'お支払いが遅延しています。新規登録してください。',
                            trialing: 'トライアル期間が終了すると自動的に課金されます。',
                          };

                          return (
                            statusMessages[
                              activeSubscription.status as keyof typeof statusMessages
                            ] || 'サブスクリプションに問題があります。'
                          );
                        })()}
                        <Button
                          className="mt-3 w-full"
                          onClick={handleSubscribe}
                          aria-label="新規サブスクリプション登録"
                          tabIndex={0}
                          disabled={pendingAction !== null}
                        >
                          {pendingAction === 'subscribe' ? '処理中...' : '新規サブスクリプション登録'}
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              ) : hasActiveSubscription ? (
                <div className="p-4 bg-gray-100 rounded text-center text-gray-700">
                  サブスクリプションは有効です。
                </div>
              ) : null}
            </CardContent>
          </Card>
          )}
        </div>
      )}
    </>
  );
}
