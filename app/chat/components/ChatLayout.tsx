'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import AnnotationPanel from './AnnotationPanel';
import StepActionBar from './StepActionBar';
import { getContentAnnotationBySession } from '@/server/handler/actions/wordpress.action';
import { BlogFlowProvider, useBlogFlow } from '@/context/BlogFlowProvider';
import { BlogStepId } from '@/lib/constants';

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

// 自動開始は行わず、明示ボタンで開始する
type ChatLayoutCtx = {
  chatSession: ChatSessionHook;
  subscription: SubscriptionHook;
  isMobile: boolean;
  blogFlowActive: boolean;
  selectedModel: string;
  ui: {
    sidebar: { open: boolean; setOpen: (open: boolean) => void };
    canvas: { open: boolean; show: (content: string) => void };
    annotation: {
      open: boolean;
      loading: boolean;
      data: {
        main_kw?: string;
        kw?: string;
        impressions?: string;
        persona?: string;
        needs?: string;
        goal?: string;
      } | null;
      openWith: (content: string) => void;
      setOpen: (open: boolean) => void;
    };
  };
  onSendMessage: (content: string, model: string) => Promise<void>;
  handleEditInCanvas: (content: string) => void;
  handleModelChange: (model: string, step?: BlogStepId) => void;
};

const ChatLayoutContent: React.FC<{ ctx: ChatLayoutCtx }> = ({ ctx }) => {
  const {
    chatSession,
    subscription,
    isMobile,
    blogFlowActive,
    selectedModel,
    ui,
    onSendMessage,
    handleEditInCanvas,

    handleModelChange,
  } = ctx;
  const { state, cancelRevision, currentIndex, totalSteps } = useBlogFlow();
  const router = useRouter();

  // ChatLayoutContent内でのblogFlowActive再計算
  const blogFlowActiveRecalculated =
    !subscription.requiresSubscription &&
    !!chatSession.state.currentSessionId &&
    selectedModel === 'blog_creation';

  // blogFlowActiveがfalseの場合は再計算値を使用
  const effectiveBlogFlowActive = blogFlowActive || blogFlowActiveRecalculated;

  const currentStep = state.current;

  const goToSubscription = () => {
    router.push('/subscription');
  };

  const [isErrorDismissed, setIsErrorDismissed] = useState(false);
  const [isSubscriptionErrorDismissed, setIsSubscriptionErrorDismissed] = useState(false);

  // エラーの表示制御
  useEffect(() => {
    setIsErrorDismissed(false);
  }, [chatSession.state.error]);

  useEffect(() => {
    setIsSubscriptionErrorDismissed(false);
  }, [subscription.error]);

  const renderAfterMessage = (message: ChatMessage) => {
    // 最新のアシスタントメッセージIDを取得（ID比較で統一）
    const assistants = chatSession.state.messages.filter(m => m.role === 'assistant');
    const lastAssistantId = assistants[assistants.length - 1]?.id;

    // StepActionBar表示条件: ブログフロー中 かつ アクション待ち かつ 最新のAIメッセージ直下
    const shouldShowActionBar =
      effectiveBlogFlowActive &&
      state.flowStatus !== 'completed' &&
      state.flowStatus !== 'error' &&
      !chatSession.state.isLoading &&
      message.role === 'assistant' &&
      message.id === lastAssistantId;

    if (shouldShowActionBar) {
      return (
        <StepActionBar
          step={currentStep}
          className="px-3 py-2 border-t bg-gray-50/50"
          disabled={chatSession.state.isLoading || ui.annotation.loading}
        />
      );
    }

    return null;
  };

  return (
    <>
      {/* デスクトップサイドバー */}
      {!isMobile && (
        <SessionSidebar
          sessions={chatSession.state.sessions}
          currentSessionId={chatSession.state.currentSessionId}
          actions={chatSession.actions}
          isLoading={chatSession.state.isLoading}
        />
      )}

      {/* モバイルサイドバー（Sheet） */}
      {isMobile && (
        <Sheet open={ui.sidebar.open} onOpenChange={ui.sidebar.setOpen}>
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
                  ui.sidebar.setOpen(false);
                },
                startNewSession: () => {
                  chatSession.actions.startNewSession();
                  ui.sidebar.setOpen(false);
                },
              }}
              isLoading={chatSession.state.isLoading}
            />
          </SheetContent>
        </Sheet>
      )}

      <div className={cn('flex-1 flex flex-col pt-16', isMobile && 'pt-16')}>
        {/* メモ編集ボタン */}
        <div className="absolute top-2 right-2 z-10 flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => ui.annotation.openWith('')}
            disabled={!chatSession.state.currentSessionId || ui.annotation.loading}
          >
            {ui.annotation.loading ? '読み込み中...' : 'メモ編集'}
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
          annotationLoading={ui.annotation.loading}
          onEditInCanvas={handleEditInCanvas}
          onShowCanvas={ui.canvas.show}
          onOpenAnnotation={ui.annotation.openWith}
          renderAfterMessage={renderAfterMessage}
          blogFlowActive={effectiveBlogFlowActive}
        />

        <InputArea
          onSendMessage={onSendMessage}
          onToggleCanvas={() => {}}
          disabled={chatSession.state.isLoading || ui.annotation.loading}
          canvasOpen={ui.canvas.open}
          currentSessionTitle={
            chatSession.state.sessions.find(s => s.id === chatSession.state.currentSessionId)
              ?.title || '新しいチャット'
          }
          isMobile={isMobile}
          onMenuToggle={isMobile ? () => ui.sidebar.setOpen(!ui.sidebar.open) : undefined}
          blogFlowActive={effectiveBlogFlowActive}
          blogProgress={{ currentIndex, total: totalSteps }}
          onModelChange={handleModelChange}
          blogFlowStatus={state.flowStatus}
          selectedModelExternal={selectedModel}
        />
      </div>

      {ui.annotation.open && (
        <AnnotationPanel
          sessionId={chatSession.state.currentSessionId || ''}
          initialData={ui.annotation.data}
          onClose={() => {
            if (state.flowStatus === 'revising') {
              cancelRevision();
            } else {
              ui.annotation.setOpen(false);
            }
          }}
          isVisible={ui.annotation.open}
        />
      )}
    </>
  );
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
    prep?: string;
    basic_structure?: string;
    opening_proposal?: string;
  } | null>(null);
  const [annotationLoading, setAnnotationLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [canvasContent, setCanvasContent] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>(
    'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2'
  );
  const [, setSelectedBlogStep] = useState<BlogStepId>('step1');

  // 履歴ベースのモデル自動検出は削除（InputArea 側でフロー状態から自動選択）

  // モデル変更ハンドラ
  const handleModelChange = useCallback((model: string, step?: BlogStepId) => {
    setSelectedModel(model);
    if (step) setSelectedBlogStep(step);
  }, []);

  // 新しいアシスタントメッセージを待つヘルパー関数（件数とID変化の両方を監視）
  const waitForNewAssistantMessage = (
    prevLastId: string | undefined,
    prevCount: number,
    getMessages: () => ChatMessage[],
    timeoutMs = 12000,
    intervalMs = 120
  ): Promise<string | undefined> => {
    const start = Date.now();
    return new Promise(resolve => {
      const timer = setInterval(() => {
        const now = Date.now();
        if (now - start > timeoutMs) {
          clearInterval(timer);
          resolve(undefined);
          return;
        }

        const assistants = getMessages().filter(m => m.role === 'assistant');
        const cur = assistants[assistants.length - 1];
        const increased = assistants.length > prevCount;
        const changed = cur?.id && cur.id !== prevLastId;

        if (increased || changed) {
          clearInterval(timer);
          resolve(cur?.id);
        }
      }, intervalMs);
    });
  };

  // BlogFlow用のagent実装
  const agent = {
    send: async (content: string, model: string) => {
      // 送信前のアシスタントメッセージ状態を記録
      const beforeAssistants = chatSession.state.messages.filter(m => m.role === 'assistant');
      const prevLastId = beforeAssistants[beforeAssistants.length - 1]?.id;
      const prevCount = beforeAssistants.length;

      // メッセージ送信
      await handleSendMessage(content, model);

      // 新しいアシスタントメッセージが現れるまで待つ（件数増加またはID変化）
      const newMessageId = await waitForNewAssistantMessage(
        prevLastId,
        prevCount,
        () => chatSession.state.messages
      );

      return { messageId: newMessageId ?? String(Date.now()) };
    },
  };

  // Revision用にCanvasパネルを開く（BlogFlow用）
  const openRevisionPanel = () => {
    console.log('openRevisionPanel called');

    if (annotationOpen) {
      setAnnotationOpen(false);
      setAnnotationData(null);
    }

    // 最新のAIメッセージを取得してCanvasパネルを開く
    const latestAIMessage = getLatestAIMessage(chatSession.state.messages);
    console.log('Setting canvas content:', latestAIMessage?.substring(0, 100));
    setCanvasContent(latestAIMessage);
    setCanvasPanelOpen(true);
    setIsManualEdit(true);
  };

  const closeCanvas = () => {
    setCanvasPanelOpen(false);
    setIsManualEdit(false);
  };

  // BlogFlow起動ガード（モデル選択と連動）
  const blogFlowActive =
    !subscription.requiresSubscription &&
    !!chatSession.state.currentSessionId &&
    selectedModel === 'blog_creation';

  // ✅ 手動編集フラグを追加
  const [isManualEdit, setIsManualEdit] = useState(false);

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
    <BlogFlowProvider
      key={chatSession.state.currentSessionId || 'no-session'}
      agent={agent}
      canvasController={{ open: openRevisionPanel, close: closeCanvas }}
      isActive={blogFlowActive}
      sessionId={chatSession.state.currentSessionId || 'no-session'}
    >
      <div className="flex h-[calc(100vh-3rem)]" data-testid="chat-layout">
        <ChatLayoutContent
          ctx={{
            chatSession,
            subscription,
            isMobile,
            blogFlowActive,
            selectedModel,
            ui: {
              sidebar: { open: sidebarOpen, setOpen: setSidebarOpen },
              canvas: { open: canvasPanelOpen, show: handleShowCanvas },
              annotation: {
                open: annotationOpen,
                loading: annotationLoading,
                data: annotationData,
                openWith: handleOpenAnnotation,
                setOpen: setAnnotationOpen,
              },
            },
            onSendMessage: handleSendMessage,
            handleEditInCanvas,
            handleModelChange,
          }}
        />

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
      </div>
    </BlogFlowProvider>
  );
};
