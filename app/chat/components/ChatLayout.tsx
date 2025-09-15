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
// import { ERROR_MESSAGES } from '@/lib/constants';
import SessionSidebar from './SessionSidebar';
import MessageArea from './MessageArea';
import InputArea from './InputArea';
import CanvasPanel from './CanvasPanel';
import AnnotationPanel from './AnnotationPanel';
import { getContentAnnotationBySession } from '@/server/handler/actions/wordpress.action';

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

const ErrorAlert: React.FC<{ error: string; onClose?: () => void }> = ({ error, onClose }) => (
  <div className="bg-red-50 border-l-4 border-red-400 p-4 m-3" role="alert" aria-live="polite">
    <div className="flex">
      <div className="flex-shrink-0">
        <AlertCircle className="h-5 w-5 text-red-400" />
      </div>
      <div className="ml-3 flex-1 break-words">
        <p className="text-sm text-red-700 break-words">{error}</p>
      </div>
      {onClose && (
        <button
          type="button"
          className="text-sm text-red-600 ml-4 hover:text-red-800 focus-visible:ring-2 focus-visible:ring-red-300 rounded"
          onClick={onClose}
          aria-label="閉じる"
        >
          ×
        </button>
      )}
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
  const [annotationOpen, setAnnotationOpen] = useState(false);
  const [annotationData, setAnnotationData] = useState<{
    main_kw?: string;
    kw?: string;
    impressions?: string;
    persona?: string;
    needs?: string;
    goal?: string;
  } | null>(null);
  const [annotationLoading, setAnnotationLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [canvasContent, setCanvasContent] = useState('');
  const router = useRouter();

  const goToSubscription = () => {
    router.push('/subscription');
  };

  // ✅ 手動編集フラグを追加
  const [isManualEdit, setIsManualEdit] = useState(false);

  // 最新AI本文（公開のデフォルト本文に使える）
  const latestAIMessage = getLatestAIMessage(chatSession.state.messages);

  // エラーのローカル dismiss 制御
  const [isErrorDismissed, setIsErrorDismissed] = useState(false);
  // クオータ上限メッセージは利用しない（自動dismissを廃止したため）
  const [isSubscriptionErrorDismissed, setIsSubscriptionErrorDismissed] = useState(false);


  // ✅ AIの返信を監視してCanvasに自動反映（手動編集時は除く、自動で開かない）
  useEffect(() => {
    // 手動編集中は自動更新をスキップ
    if (isManualEdit) return;

    const messages = chatSession.state.messages;
    const latestAIMessage = getLatestAIMessage(messages);

    if (latestAIMessage && latestAIMessage !== canvasContent) {
      setCanvasContent(latestAIMessage);
      // ✅ AIの返信があっても自動でCanvasを開かない（ユーザーがホバー→クリックした時のみ開く）
    }
  }, [chatSession.state.messages, canvasContent, isManualEdit]);

  // 新しいエラーメッセージが来たら再表示
  useEffect(() => {
    setIsErrorDismissed(false);
  }, [chatSession.state.error]);

  // エラーの自動dismissは行わない（ユーザーが明示的に閉じるのみ）

  // サブスクリプションエラーが変わったら再表示
  useEffect(() => {
    setIsSubscriptionErrorDismissed(false);
  }, [subscription.error]);

  // ✅ セッション切り替え時にパネルを自動的に閉じる
  useEffect(() => {
    setCanvasPanelOpen(false);
    setAnnotationOpen(false);
    setAnnotationData(null);
    setAnnotationLoading(false);
    setIsManualEdit(false);
  }, [chatSession.state.currentSessionId]);

  // ✅ メッセージ送信時に初期化を実行
  const handleSendMessage = async (content: string, model: string) => {
    try {
      // 新規メッセージ送信時は手動編集フラグをリセット
      setIsManualEdit(false);
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
      // Canvasを開く場合は、Annotationパネルが開いている時は同時に切り替え
      if (!canvasPanelOpen && annotationOpen) {
        setAnnotationOpen(false);
        setAnnotationData(null);
      }
      setCanvasPanelOpen(!canvasPanelOpen);
    } catch (error) {
      console.error('Canvas toggle failed:', error);
      // エラー時でもCanvas切り替えを実行
      if (!canvasPanelOpen && annotationOpen) {
        setAnnotationOpen(false);
        setAnnotationData(null);
      }
      setCanvasPanelOpen(!canvasPanelOpen);
    }
  };

  // ✅ 過去のメッセージをCanvasで編集する関数
  const handleEditInCanvas = (content: string) => {
    setIsManualEdit(true); // 手動編集フラグを設定
    setCanvasContent(content);
    
    // Annotationパネルが開いている場合は同時に切り替え
    if (annotationOpen) {
      setAnnotationOpen(false);
      setAnnotationData(null);
    }
    setCanvasPanelOpen(true);
  };

  // ✅ Canvasボタンクリック時にCanvasPanelを表示する関数
  const handleShowCanvas = (content: string) => {
    setCanvasContent(content);
    
    // Annotationパネルが開いている場合は同時に切り替え
    if (annotationOpen) {
      setAnnotationOpen(false);
      setAnnotationData(null);
    }
    setCanvasPanelOpen(true);
  };

  // ✅ 保存ボタンクリック時にAnnotationPanelを表示する関数
  const handleOpenAnnotation = async (content: string) => {
    if (!chatSession.state.currentSessionId) return;
    
    setAnnotationLoading(true);
    try {
      // 最新AIメッセージをデフォルトHTMLコンテンツとして設定
      setCanvasContent(content);
      
      // データベースから既存のアノテーションデータを取得
      const res = await getContentAnnotationBySession(chatSession.state.currentSessionId);
      if (res.success && res.data) {
        setAnnotationData(res.data);
      } else {
        setAnnotationData(null);
      }
      
      // Canvasパネルが開いている場合は同時に切り替え
      if (canvasPanelOpen) {
        setCanvasPanelOpen(false);
        setIsManualEdit(false);
      }
      
      // データ取得完了後にパネルを表示
      setAnnotationOpen(true);
    } catch (error) {
      console.error('Failed to load annotation data:', error);
      setAnnotationData(null);
      
      // エラーでも切り替えを実行
      if (canvasPanelOpen) {
        setCanvasPanelOpen(false);
        setIsManualEdit(false);
      }
      setAnnotationOpen(true);
    } finally {
      setAnnotationLoading(false);
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
        {/* メモ編集ボタン */}
        <div className="absolute top-2 right-2 z-10 flex gap-2">
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => handleOpenAnnotation('')}
            disabled={!chatSession.state.currentSessionId || annotationLoading}
          >
            {annotationLoading ? '読み込み中...' : 'メモ編集'}
          </Button>
        </div>
        {subscription.requiresSubscription && (
          <SubscriptionAlert error={subscription.error} onGoToSubscription={goToSubscription} />
        )}

        {subscription.error &&
          !subscription.requiresSubscription &&
          !isSubscriptionErrorDismissed && (
            <ErrorAlert
              error={subscription.error}
              onClose={() => setIsSubscriptionErrorDismissed(true)}
            />
          )}

        {chatSession.state.error && !isErrorDismissed && (
          <ErrorAlert error={chatSession.state.error} onClose={() => setIsErrorDismissed(true)} />
        )}

        <MessageArea
          messages={chatSession.state.messages}
          isLoading={chatSession.state.isLoading}
          annotationLoading={annotationLoading}
          onEditInCanvas={handleEditInCanvas}
          onShowCanvas={handleShowCanvas}
          onOpenAnnotation={handleOpenAnnotation}
        />

        <InputArea
          onSendMessage={handleSendMessage} // ✅ 初期化付きメッセージ送信
          onToggleCanvas={handleToggleCanvas} // ✅ 初期化付きCanvas切り替え
          disabled={chatSession.state.isLoading || annotationLoading}
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
          onClose={() => {
            setCanvasPanelOpen(false);
            setIsManualEdit(false); // Canvas閉じる時も手動編集フラグをリセット
          }}
          content={canvasContent}
          isVisible={canvasPanelOpen}
        />
      )}

      {annotationOpen && (
        <AnnotationPanel
          sessionId={chatSession.state.currentSessionId || ''}
          defaultTitle={''}
          defaultContentHtml={canvasContent || latestAIMessage}
          initialData={annotationData}
          onClose={() => setAnnotationOpen(false)}
          isVisible={annotationOpen}
        />
      )}
    </div>
  );
};
