'use client';

import React from 'react';
import { useLiffContext } from '@/components/LiffProvider';
import { createChatService, createSubscriptionService } from '@/di/container';
import { useChatSession } from '@/hooks/useChatSession';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useMobile } from '@/hooks/useMobile';
import { ChatLayout } from './components/ChatLayout';
import ErrorBoundary from './components/common/ErrorBoundary';
import { FullscreenLoadingSpinner } from './components/common/LoadingSpinner';

/**
 * ChatClient - Dependency Injection Container & Root State Provider
 *
 * 責任:
 * 1. DIコンテナからサービスを注入
 * 2. 全てのフックを初期化
 * 3. ChatLayoutに状態を提供
 *
 */
const ChatClient: React.FC = () => {
  const { isLoggedIn, login, getAccessToken, isLoading: liffLoading } = useLiffContext();
  const { isMobile } = useMobile();

  // ✅ 必要なサービスのみ作成
  const { chatService, subscriptionService } = React.useMemo(() => {
    const chat = createChatService();
    const subscription = createSubscriptionService();

    return {
      chatService: chat,
      subscriptionService: subscription,
    };
  }, []);

  // ✅ サービスにaccessTokenProviderを設定（getAccessTokenが変わっても再作成されない）
  React.useEffect(() => {
    // chatServiceにsetAccessTokenProviderメソッドがあるかチェック
    if (
      chatService &&
      'setAccessTokenProvider' in chatService &&
      typeof chatService.setAccessTokenProvider === 'function'
    ) {
      chatService.setAccessTokenProvider(getAccessToken);
    }
  }, [chatService, getAccessToken]);

  // 各機能のフックを初期化
  const chatSession = useChatSession(chatService, getAccessToken);
  const subscription = useSubscriptionStatus(subscriptionService, getAccessToken, isLoggedIn);
  const hasInitializedRef = React.useRef(false);

  // ✅ 初期マウント時（画面遷移時）のみ初期化（1回のみ実行保証）
  React.useEffect(() => {
    if (isLoggedIn && !liffLoading && !hasInitializedRef.current) {
      hasInitializedRef.current = true;

      // サブスクリプション確認とセッション読み込みを並行実行
      Promise.all([
        subscription.actions.checkSubscription(),
        chatSession.actions.loadSessions ? chatSession.actions.loadSessions() : Promise.resolve(),
      ]).catch(error => {
        console.error('❌ 初期化エラー:', error);
        // エラー時はフラグをリセットして再試行可能にする
        hasInitializedRef.current = false;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, liffLoading]); // ✅ 安全な依存配列のみ（actionsを含めると無限ループ）

  // LIFF初期化中のローディング表示
  if (liffLoading) {
    return <FullscreenLoadingSpinner text="初期化中..." />;
  }

  return (
    <ErrorBoundary>
      <ChatLayout
        chatSession={chatSession}
        subscription={subscription}
        isLoggedIn={isLoggedIn}
        login={login}
        isMobile={isMobile}
      />
    </ErrorBoundary>
  );
};

export default ChatClient;
