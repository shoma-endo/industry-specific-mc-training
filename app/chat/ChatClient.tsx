'use client';

import React from 'react';
import { useLiffContext } from '@/components/LiffProvider';
import { ChatService } from '@/domain/services/ChatService';
import { SubscriptionService } from '@/domain/services/SubscriptionService';
import { useChatSession } from '@/hooks/useChatSession';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useMobile } from '@/hooks/useMobile';
import { ChatLayout } from './components/ChatLayout';
import ErrorBoundary from './components/common/ErrorBoundary';

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
  const { isLoggedIn, getAccessToken, isLoading: liffLoading } = useLiffContext();
  const { isMobile } = useMobile();

  // ✅ 必要なサービスのみ作成
  const { chatService, subscriptionService } = React.useMemo(() => {
    const chat = new ChatService();
    const subscription = new SubscriptionService();

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

  // ✅ 初期マウント時（画面遷移時）のみ初期化（1回のみ実行保証）
  React.useEffect(() => {
    if (isLoggedIn && !liffLoading) {
      // サブスクリプション確認とセッション読み込みを並行実行
      Promise.all([
        subscription.actions.checkSubscription(),
        chatSession.actions.loadSessions ? chatSession.actions.loadSessions() : Promise.resolve(),
      ]).catch(error => {
        console.error('❌ 初期化エラー:', error);
        // エラー時はサブスクリプション初期化状態をリセット
        subscription.actions.resetInitialization();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, liffLoading]); // ✅ 安全な依存配列のみ（actionsを含めると無限ループ）

  // LIFF初期化中はLiffProviderが表示を担当するため、ここでは何も表示しない
  if (liffLoading) {
    return null;
  }

  return (
    <ErrorBoundary>
      <ChatLayout chatSession={chatSession} subscription={subscription} isMobile={isMobile} />
    </ErrorBoundary>
  );
};

export default ChatClient;
