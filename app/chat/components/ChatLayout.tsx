'use client';

import React, { useState, useEffect } from 'react';
import { ChatSessionHook } from '@/hooks/useChatSession';
import { SubscriptionHook } from '@/hooks/useSubscriptionStatus';
import { ChatMessage } from '@/domain/interfaces/IChatService';
import { Button } from '@/components/ui/button';
import { Bot, AlertCircle, Menu } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import SessionSidebar from './SessionSidebar';
import MessageArea from './MessageArea';
import InputArea from './InputArea';
import CanvasPanel from './CanvasPanel';

interface ChatLayoutProps {
  chatSession: ChatSessionHook;
  subscription: SubscriptionHook;
  isLoggedIn: boolean;
  login: () => void;
  isMobile?: boolean;
}

const LoginPrompt: React.FC<{ onLogin: () => void }> = ({ onLogin }) => (
  <div className="flex items-center justify-center h-[calc(100vh-3rem)]">
    <Card className="p-6 text-center max-w-xs w-full shadow-lg rounded-xl">
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <Bot size={32} className="text-primary" />
      </div>
      <h2 className="text-lg font-semibold mb-3">AIアシスタントにログイン</h2>
      <p className="text-sm text-muted-foreground mb-4">
        AIアシスタントを利用するにはLINEでログインしてください。
      </p>
      <Button onClick={onLogin} className="w-full">
        LINEでログイン
      </Button>
    </Card>
  </div>
);

const SubscriptionAlert: React.FC<{
  error: string | null;
  onGoToSubscription: () => void;
}> = ({ error, onGoToSubscription }) => (
  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 m-3">
    <div className="flex">
      <div className="flex-shrink-0">
        <AlertCircle className="h-5 w-5 text-yellow-400" />
      </div>
      <div className="ml-3 flex-1">
        <p className="text-sm text-yellow-700">
          {error || 'チャット機能を利用するにはサブスクリプションが必要です'}
        </p>
        <div className="mt-2">
          <Button variant="outline" size="sm" onClick={onGoToSubscription} className="text-xs">
            サブスクリプションに登録する
          </Button>
        </div>
      </div>
    </div>
  </div>
);

const ErrorAlert: React.FC<{ error: string }> = ({ error }) => (
  <div className="bg-red-50 border-l-4 border-red-400 p-4 m-3">
    <div className="flex">
      <div className="flex-shrink-0">
        <AlertCircle className="h-5 w-5 text-red-400" />
      </div>
      <div className="ml-3">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    </div>
  </div>
);

// ✅ 最新のAIメッセージを取得する関数
const getLatestAIMessage = (messages: ChatMessage[]) => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message && message.role === 'assistant') {
      return message.content;
    }
  }
  return '';
};

export const ChatLayout: React.FC<ChatLayoutProps> = ({
  chatSession,
  subscription,
  isLoggedIn,
  login,
  isMobile = false,
}) => {
  const [canvasPanelOpen, setCanvasPanelOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [canvasContent, setCanvasContent] = useState('');
  const router = useRouter();

  const goToSubscription = () => {
    router.push('/subscription');
  };

  // ✅ AIの返信を監視してCanvasに自動反映
  useEffect(() => {
    const messages = chatSession.state.messages;
    const latestAIMessage = getLatestAIMessage(messages);

    if (latestAIMessage && latestAIMessage !== canvasContent) {
      setCanvasContent(latestAIMessage);
      // ✅ AIの返信があったらCanvasを自動で開く
      if (!canvasPanelOpen) {
        setCanvasPanelOpen(true);
      }
    }
  }, [chatSession.state.messages, canvasContent, canvasPanelOpen]);

  // ✅ メッセージ送信時に初期化を実行
  const handleSendMessage = async (content: string, model: string) => {
    try {
      // 初期化を実行してからメッセージ送信
      await chatSession.actions.sendMessage(content, model);
    } catch (error) {
      console.error('Message send failed:', error);
      // エラー時でもメッセージ送信を試行
      await chatSession.actions.sendMessage(content, model);
    }
  };

  // ✅ Canvas切り替え時に初期化を実行
  const handleToggleCanvas = async () => {
    try {
      setCanvasPanelOpen(!canvasPanelOpen);
    } catch (error) {
      console.error('Canvas toggle failed:', error);
      // エラー時でもCanvas切り替えを実行
      setCanvasPanelOpen(!canvasPanelOpen);
    }
  };

  if (!isLoggedIn) {
    return <LoginPrompt onLogin={login} />;
  }

  return (
    <div className="flex h-[calc(100vh-3rem)]" data-testid="chat-layout">
      {/* デスクトップサイドバー */}
      {!isMobile && (
        <SessionSidebar
          sessions={chatSession.state.sessions}
          currentSessionId={chatSession.state.currentSessionId}
          actions={chatSession.actions}
          isLoading={chatSession.state.isLoading} // ✅ 読み込み状態を渡す
        />
      )}

      {/* モバイルサイドバー（Sheet） */}
      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 left-2 z-10"
              aria-label="メニューを開く"
            >
              <Menu size={20} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 max-w-[280px] sm:max-w-[280px]">
            <SessionSidebar
              sessions={chatSession.state.sessions}
              currentSessionId={chatSession.state.currentSessionId}
              actions={{
                ...chatSession.actions,
                loadSession: async (sessionId: string) => {
                  await chatSession.actions.loadSession(sessionId);
                  setSidebarOpen(false); // ✅ モバイルでセッション選択後は閉じるのみ
                },
                startNewSession: () => {
                  chatSession.actions.startNewSession();
                  setSidebarOpen(false); // ✅ モバイルで新しいチャット後は閉じるのみ
                },
              }}
              isLoading={chatSession.state.isLoading} // ✅ 読み込み状態を渡す
            />
          </SheetContent>
        </Sheet>
      )}

      <div
        className={cn(
          'flex-1 flex flex-col pt-16', // 固定ヘッダー分のpadding-topを全体に適用
          isMobile && 'pt-16' // モバイルでも同じpadding-topを使用
        )}
      >
        {subscription.requiresSubscription && (
          <SubscriptionAlert error={subscription.error} onGoToSubscription={goToSubscription} />
        )}

        {subscription.error && !subscription.requiresSubscription && (
          <ErrorAlert error={subscription.error} />
        )}

        <MessageArea
          messages={chatSession.state.messages}
          isLoading={chatSession.state.isLoading}
        />

        <InputArea
          onSendMessage={handleSendMessage} // ✅ 初期化付きメッセージ送信
          onToggleCanvas={handleToggleCanvas} // ✅ 初期化付きCanvas切り替え
          disabled={chatSession.state.isLoading}
          canvasOpen={canvasPanelOpen}
          currentSessionTitle={
            chatSession.state.sessions.find(s => s.id === chatSession.state.currentSessionId)
              ?.title || '新しいチャット'
          }
          isMobile={isMobile}
          onMenuToggle={isMobile ? () => setSidebarOpen(!sidebarOpen) : undefined}
        />
      </div>

      {canvasPanelOpen && (
        <CanvasPanel
          onClose={() => setCanvasPanelOpen(false)}
          content={canvasContent}
          isVisible={canvasPanelOpen}
        />
      )}
    </div>
  );
};
