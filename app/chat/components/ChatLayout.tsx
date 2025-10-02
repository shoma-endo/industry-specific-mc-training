'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChatSessionHook } from '@/hooks/useChatSession';
import { SubscriptionHook } from '@/hooks/useSubscriptionStatus';
import { ChatMessage } from '@/domain/interfaces/IChatService';
import { Button } from '@/components/ui/button';
import { Bot, AlertCircle, Menu } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  extractBlogStepFromModel,
  findLatestAssistantBlogStep,
  normalizeCanvasContent,
  isBlogStepId,
} from '@/lib/blog-canvas';
import SessionSidebar from './SessionSidebar';
import MessageArea from './MessageArea';
import InputArea from './InputArea';
import CanvasPanel from './CanvasPanel';
import type { CanvasSelectionEditPayload, CanvasSelectionEditResult } from '@/types/canvas';
import AnnotationPanel from './AnnotationPanel';
import type { StepActionBarRef } from './StepActionBar';
import { getContentAnnotationBySession } from '@/server/handler/actions/wordpress.action';
import { BlogFlowProvider, useBlogFlow } from '@/context/BlogFlowProvider';
import { BlogStepId, BLOG_STEP_IDS, BLOG_PLACEHOLDERS, BLOG_STEP_LABELS } from '@/lib/constants';
import { useAnnotationStore } from '@/store/annotationStore';

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

type BlogCanvasVersion = {
  id: string;
  content: string;
  raw: string;
  step: BlogStepId;
  model?: string;
  createdAt: number;
};

type StepVersionsMap = Record<BlogStepId, BlogCanvasVersion[]>;

// 自動開始は行わず、明示ボタンで開始する
type ChatLayoutCtx = {
  chatSession: ChatSessionHook;
  subscription: SubscriptionHook;
  isMobile: boolean;
  blogFlowActive: boolean;
  selectedModel: string;
  latestBlogStep: BlogStepId | null;
  availableSteps: BlogStepId[];
  manualSelectedStep: BlogStepId | null;
  stepActionBarRef: React.RefObject<StepActionBarRef | null>;
  ui: {
    sidebar: { open: boolean; setOpen: (open: boolean) => void };
    canvas: { open: boolean; show: (message: ChatMessage) => void };
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
      openWith: () => void;
      setOpen: (open: boolean) => void;
    };
  };
  onSendMessage: (content: string, model: string) => Promise<void>;
  handleModelChange: (model: string, step?: BlogStepId) => void;
  handleStepChange: (step: BlogStepId) => void;
  placeholderOverride: string;
  nextStepForPlaceholder: BlogStepId | null;
};

const ChatLayoutContent: React.FC<{ ctx: ChatLayoutCtx }> = ({ ctx }) => {
  const {
    chatSession,
    subscription,
    isMobile,
    blogFlowActive,
    selectedModel,
    latestBlogStep,
    availableSteps,
    manualSelectedStep,
    stepActionBarRef,
    ui,
    onSendMessage,
    handleModelChange,
    handleStepChange,
    placeholderOverride,
    nextStepForPlaceholder,
  } = ctx;
  const { state, cancelRevision, currentIndex, totalSteps } = useBlogFlow();
  const lastAssistantMessageIdRef = useRef<string | undefined>(undefined);
  const router = useRouter();

  // ChatLayoutContent内でのblogFlowActive再計算
  const blogFlowActiveRecalculated =
    !subscription.requiresSubscription &&
    !!chatSession.state.currentSessionId &&
    selectedModel === 'blog_creation';

  // blogFlowActiveがfalseの場合は再計算値を使用
  const effectiveBlogFlowActive = blogFlowActive || blogFlowActiveRecalculated;

  const currentStep = state.current;
  const displayStep = manualSelectedStep ?? latestBlogStep ?? currentStep;
  const hasDetectedBlogStep = latestBlogStep !== null;
  const displayIndex = useMemo(() => {
    const index = BLOG_STEP_IDS.indexOf(displayStep);
    return index >= 0 ? index : currentIndex;
  }, [displayStep, currentIndex]);

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

  const assistantMessages = useMemo(
    () => (chatSession.state.messages ?? []).filter(message => message.role === 'assistant'),
    [chatSession.state.messages]
  );
  const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];

  useEffect(() => {
    // 新しいアシスタントの返信が届いたら、修正モードを解除してステップアクションを再び有効化する
    const lastAssistantId = lastAssistantMessage?.id;

    if (state.flowStatus === 'revising') {
      if (!lastAssistantMessageIdRef.current) {
        lastAssistantMessageIdRef.current = lastAssistantId;
        return;
      }

      if (lastAssistantId && lastAssistantId !== lastAssistantMessageIdRef.current) {
        cancelRevision();
        lastAssistantMessageIdRef.current = lastAssistantId;
        return;
      }

      lastAssistantMessageIdRef.current = lastAssistantId;
      return;
    }

    lastAssistantMessageIdRef.current = lastAssistantId;
  }, [lastAssistantMessage?.id, state.flowStatus, cancelRevision]);

  const shouldShowStepActionBar =
    effectiveBlogFlowActive &&
    state.flowStatus !== 'error' &&
    !chatSession.state.isLoading &&
    !!lastAssistantMessage;

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
            onClick={() => ui.annotation.openWith()}
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
          blogFlowActive={effectiveBlogFlowActive}
          onOpenCanvas={message => ui.canvas.show(message)}
        />

        <InputArea
          onSendMessage={onSendMessage}
          disabled={chatSession.state.isLoading || ui.annotation.loading}
          shouldShowStepActionBar={shouldShowStepActionBar}
          stepActionBarRef={stepActionBarRef}
          displayStep={displayStep}
          hasDetectedBlogStep={hasDetectedBlogStep}
          availableSteps={availableSteps}
          onStepChange={handleStepChange}
          onSaveClick={() => ui.annotation.openWith()}
          annotationLoading={ui.annotation.loading}
          stepActionBarDisabled={chatSession.state.isLoading || ui.annotation.loading}
          manualSelectedStep={manualSelectedStep}
          currentSessionTitle={
            chatSession.state.sessions.find(s => s.id === chatSession.state.currentSessionId)
              ?.title || '新しいチャット'
          }
          currentSessionId={chatSession.state.currentSessionId}
          isMobile={isMobile}
          onMenuToggle={isMobile ? () => ui.sidebar.setOpen(!ui.sidebar.open) : undefined}
          blogFlowActive={effectiveBlogFlowActive}
          blogProgress={{ currentIndex: displayIndex, total: totalSteps }}
          onModelChange={handleModelChange}
          blogFlowStatus={state.flowStatus}
          selectedModelExternal={selectedModel}
          placeholderOverride={placeholderOverride}
          nextStepForPlaceholder={nextStepForPlaceholder}
          {...(latestBlogStep ? { initialBlogStep: latestBlogStep } : {})}
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
          onSaveSuccess={() => {}}
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
  const { setSavedFields } = useAnnotationStore();
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
  const [canvasStep, setCanvasStep] = useState<BlogStepId | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(
    'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2'
  );
  const [, setSelectedBlogStep] = useState<BlogStepId>('step1');
  const [manualSelectedStep, setManualSelectedStep] = useState<BlogStepId | null>(null);
  const [selectedVersionByStep, setSelectedVersionByStep] = useState<
    Partial<Record<BlogStepId, string | null>>
  >({});
  const [followLatestByStep, setFollowLatestByStep] = useState<
    Partial<Record<BlogStepId, boolean>>
  >({});
  const [placeholderOverride, setPlaceholderOverride] = useState<string>('');
  const [nextStepForPlaceholder, setNextStepForPlaceholder] = useState<BlogStepId | null>(null);
  const latestBlogStep = useMemo(
    () => findLatestAssistantBlogStep(chatSession.state.messages ?? []),
    [chatSession.state.messages]
  );

  const chatStateRef = useRef(chatSession.state);
  const canvasEditInFlightRef = useRef(false);

  useEffect(() => {
    chatStateRef.current = chatSession.state;
  }, [chatSession.state]);

  useEffect(() => {
    const sessionId = chatSession.state.currentSessionId;
    if (!sessionId) {
      return;
    }

    let isActive = true;

    const loadAnnotations = async () => {
      try {
        const res = await getContentAnnotationBySession(sessionId);
        if (!isActive) return;

        if (res.success && res.data) {
          setAnnotationData(res.data);
          setSavedFields(sessionId, {
            needs: !!res.data.needs,
            persona: !!res.data.persona,
            goal: !!res.data.goal,
            prep: !!res.data.prep,
            basic_structure: !!res.data.basic_structure,
            opening_proposal: !!res.data.opening_proposal,
          });
        } else {
          setAnnotationData(null);
          setSavedFields(sessionId, {
            needs: false,
            persona: false,
            goal: false,
            prep: false,
            basic_structure: false,
            opening_proposal: false,
          });
        }
      } catch (error) {
        console.error('Failed to preload annotation data:', error);
      }
    };

    loadAnnotations();

    return () => {
      isActive = false;
    };
  }, [chatSession.state.currentSessionId, setSavedFields]);

  // 利用可能なステップを計算（最新AIメッセージのステップまで）
  const availableSteps = useMemo(() => {
    if (!latestBlogStep) return [];
    const latestIndex = BLOG_STEP_IDS.indexOf(latestBlogStep);
    if (latestIndex === -1) return [];
    return BLOG_STEP_IDS.slice(0, latestIndex + 1);
  }, [latestBlogStep]);

  const blogCanvasVersionsByStep = useMemo<StepVersionsMap>(() => {
    const initialMap = BLOG_STEP_IDS.reduce((acc, step) => {
      acc[step] = [] as BlogCanvasVersion[];
      return acc;
    }, {} as StepVersionsMap);

    (chatSession.state.messages ?? []).forEach(message => {
      if (!message || message.role !== 'assistant') return;
      const step = extractBlogStepFromModel(message.model);
      if (!step) return;

      const normalizedContent = normalizeCanvasContent(message.content);
      const version: BlogCanvasVersion = {
        id: message.id,
        content: normalizedContent,
        raw: message.content,
        step,
        createdAt: message.timestamp ? message.timestamp.getTime() : 0,
      };

      if (message.model) {
        version.model = message.model;
      }

      initialMap[step].push(version);
    });

    BLOG_STEP_IDS.forEach(step => {
      initialMap[step].sort((a, b) => {
        if (a.createdAt !== b.createdAt) {
          return a.createdAt - b.createdAt;
        }
        return a.id.localeCompare(b.id);
      });
    });

    return initialMap;
  }, [chatSession.state.messages]);

  useEffect(() => {
    const selectionUpdates: Partial<Record<BlogStepId, string | null>> = {};
    const followUpdates: Partial<Record<BlogStepId, boolean>> = {};
    let selectionChanged = false;
    let followChanged = false;

    BLOG_STEP_IDS.forEach(step => {
      const versions = blogCanvasVersionsByStep[step] ?? [];
      const latestId = versions.length ? (versions[versions.length - 1]?.id ?? null) : null;
      const currentSelection = selectedVersionByStep[step] ?? null;
      const followLatest = followLatestByStep[step] !== false;
      const currentExists =
        currentSelection !== null && versions.some(version => version.id === currentSelection);

      if (!versions.length) {
        if (currentSelection !== null) {
          selectionUpdates[step] = null;
          selectionChanged = true;
        }
        if (followLatestByStep[step] !== undefined && followLatestByStep[step] !== true) {
          followUpdates[step] = true;
          followChanged = true;
        }
        return;
      }

      if (!currentExists) {
        if (latestId) {
          selectionUpdates[step] = latestId;
          selectionChanged = true;
        }
        if (followLatestByStep[step] !== true) {
          followUpdates[step] = true;
          followChanged = true;
        }
        return;
      }

      if (followLatest && latestId && currentSelection !== latestId) {
        selectionUpdates[step] = latestId;
        selectionChanged = true;
      }
    });

    if (selectionChanged) {
      setSelectedVersionByStep(prev => {
        const next = { ...prev };
        BLOG_STEP_IDS.forEach(step => {
          if (Object.prototype.hasOwnProperty.call(selectionUpdates, step)) {
            next[step] = selectionUpdates[step] ?? null;
          }
        });
        return next;
      });
    }

    if (followChanged) {
      setFollowLatestByStep(prev => {
        const next = { ...prev };
        BLOG_STEP_IDS.forEach(step => {
          if (Object.prototype.hasOwnProperty.call(followUpdates, step)) {
            next[step] = followUpdates[step] ?? true;
          }
        });
        return next;
      });
    }
  }, [blogCanvasVersionsByStep, selectedVersionByStep, followLatestByStep]);

  const resolvedCanvasStep = useMemo<BlogStepId | null>(() => {
    if (canvasStep) return canvasStep;
    if (manualSelectedStep) return manualSelectedStep;
    if (latestBlogStep) return latestBlogStep;
    return null;
  }, [canvasStep, manualSelectedStep, latestBlogStep]);

  const canvasVersionsForStep = useMemo<BlogCanvasVersion[]>(() => {
    if (!resolvedCanvasStep) return [];
    return blogCanvasVersionsByStep[resolvedCanvasStep] ?? [];
  }, [blogCanvasVersionsByStep, resolvedCanvasStep]);

  const activeVersionId = resolvedCanvasStep
    ? (selectedVersionByStep[resolvedCanvasStep] ?? null)
    : null;

  const activeCanvasVersion = useMemo(() => {
    if (!resolvedCanvasStep) return null;
    const versions = blogCanvasVersionsByStep[resolvedCanvasStep] ?? [];
    if (!versions.length) return null;
    if (activeVersionId) {
      const matched = versions.find(version => version.id === activeVersionId);
      if (matched) return matched;
    }
    return versions[versions.length - 1];
  }, [resolvedCanvasStep, activeVersionId, blogCanvasVersionsByStep]);

  const canvasContent = activeCanvasVersion?.content ?? '';

  const canvasVersionsWithMeta = useMemo(() => {
    return canvasVersionsForStep.map((version, index) => ({
      ...version,
      versionNumber: index + 1,
      isLatest: index === canvasVersionsForStep.length - 1,
    }));
  }, [canvasVersionsForStep]);

  const canvasStepOptions = useMemo(
    () =>
      BLOG_STEP_IDS.filter(step => (blogCanvasVersionsByStep[step] ?? []).length > 0).map(step => ({
        id: step,
        label: BLOG_STEP_LABELS[step] ?? step,
      })),
    [blogCanvasVersionsByStep]
  );

  // 履歴ベースのモデル自動検出は削除（InputArea 側でフロー状態から自動選択）

  // StepActionBarのrefを定義
  const stepActionBarRef = useRef<StepActionBarRef>(null);

  // StepActionBarのnextStep情報を更新する関数
  const updateNextStepInfo = useCallback(() => {
    if (stepActionBarRef.current) {
      const stepInfo = stepActionBarRef.current.getCurrentStepInfo();
      setNextStepForPlaceholder(stepInfo.nextStep);
    }
  }, []);

  // StepActionBarの状態変更を監視してnextStep情報を更新
  useEffect(() => {
    updateNextStepInfo();
  }, [manualSelectedStep, latestBlogStep, updateNextStepInfo]);

  // モデル変更ハンドラ
  const handleModelChange = useCallback((model: string, step?: BlogStepId) => {
    setSelectedModel(model);
    if (step) setSelectedBlogStep(step);
  }, []);

  // 新しいアシスタントメッセージを待つヘルパー関数（件数とID変化の両方を監視）
  const waitForNewAssistantMessage = useCallback(
    (
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
    },
    []
  );

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
    if (annotationOpen) {
      setAnnotationOpen(false);
      setAnnotationData(null);
    }

    const fallbackStep = (manualSelectedStep ?? latestBlogStep ?? BLOG_STEP_IDS[0]) as BlogStepId;
    const versions = blogCanvasVersionsByStep[fallbackStep] ?? [];
    const latestVersionId = versions.length ? (versions[versions.length - 1]?.id ?? null) : null;

    setCanvasStep(fallbackStep);
    if (latestVersionId) {
      setSelectedVersionByStep(prev => {
        const next = { ...prev };
        next[fallbackStep] = latestVersionId;
        return next;
      });
    }
    setFollowLatestByStep(prev => {
      const next = { ...prev };
      next[fallbackStep] = true;
      return next;
    });
    setCanvasPanelOpen(true);
    setIsManualEdit(true);
  };

  const closeCanvas = () => {
    setCanvasPanelOpen(false);
    setIsManualEdit(false);
    setCanvasStep(null);
  };

  // BlogFlow起動ガード（モデル選択と連動）
  const blogFlowActive =
    !subscription.requiresSubscription &&
    !!chatSession.state.currentSessionId &&
    selectedModel === 'blog_creation';

  // ✅ 手動編集フラグを追加
  const [, setIsManualEdit] = useState(false);

  // ✅ セッション切り替え時にパネルを自動的に閉じる
  useEffect(() => {
    setCanvasPanelOpen(false);
    setAnnotationOpen(false);
    setAnnotationData(null);
    setAnnotationLoading(false);
    setIsManualEdit(false);
    setCanvasStep(null);
    setSelectedVersionByStep({});
    setFollowLatestByStep({});
    setManualSelectedStep(null);
    setPlaceholderOverride('');
    setNextStepForPlaceholder(null);
  }, [chatSession.state.currentSessionId]);

  // ✅ メッセージ送信時に初期化を実行
  const handleSendMessage = async (content: string, model: string) => {
    try {
      // 新規メッセージ送信時は手動編集フラグと選択ステップをリセット
      setIsManualEdit(false);
      setManualSelectedStep(null);
      setPlaceholderOverride('');
      setNextStepForPlaceholder(null);
      // 初期化を実行してからメッセージ送信
      await chatSession.actions.sendMessage(content, model);
    } catch (error) {
      console.error('Message send failed:', error);
      // エラー時でもメッセージ送信を試行
      await chatSession.actions.sendMessage(content, model);
    }
  };

  // ✅ Canvasボタンクリック時にCanvasPanelを表示する関数
  const handleShowCanvas = useCallback(
    (message: ChatMessage) => {
      const fallbackStep = (manualSelectedStep ?? latestBlogStep ?? BLOG_STEP_IDS[0]) as BlogStepId;
      const detectedStep = (extractBlogStepFromModel(message.model) ?? fallbackStep) as BlogStepId;
      const versions = blogCanvasVersionsByStep[detectedStep] ?? [];
      const latestVersionId = versions.length ? (versions[versions.length - 1]?.id ?? null) : null;
      const hasExactMatch = versions.some(version => version.id === message.id);
      const targetVersionId = hasExactMatch ? message.id : latestVersionId;

      setCanvasStep(detectedStep);
      setSelectedVersionByStep(prev => {
        const next = { ...prev };
        next[detectedStep] = targetVersionId ?? null;
        return next;
      });
      setFollowLatestByStep(prev => {
        const next = { ...prev };
        next[detectedStep] = targetVersionId !== null && targetVersionId === latestVersionId;
        return next;
      });
      setIsManualEdit(true);

      if (annotationOpen) {
        setAnnotationOpen(false);
        setAnnotationData(null);
      }
      setCanvasPanelOpen(true);
    },
    [annotationOpen, blogCanvasVersionsByStep, latestBlogStep, manualSelectedStep, setIsManualEdit]
  );

  // ✅ 保存ボタンクリック時にAnnotationPanelを表示する関数
  const handleOpenAnnotation = async () => {
    if (!chatSession.state.currentSessionId) return;

    setAnnotationLoading(true);
    try {
      // データベースから既存のアノテーションデータを取得
      const res = await getContentAnnotationBySession(chatSession.state.currentSessionId);
      if (res.success && res.data) {
        setAnnotationData(res.data);

        // zustandストアに保存済みフィールドを記録
        setSavedFields(chatSession.state.currentSessionId, {
          needs: !!res.data.needs,
          persona: !!res.data.persona,
          goal: !!res.data.goal,
          prep: !!res.data.prep,
          basic_structure: !!res.data.basic_structure,
          opening_proposal: !!res.data.opening_proposal,
        });
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

  const handleCanvasVersionSelect = useCallback(
    (versionId: string) => {
      const step = resolvedCanvasStep;
      if (!step) return;
      const versions = blogCanvasVersionsByStep[step] ?? [];
      const latestId = versions.length ? (versions[versions.length - 1]?.id ?? null) : null;

      setSelectedVersionByStep(prev => {
        const next = { ...prev };
        next[step] = versionId;
        return next;
      });
      setFollowLatestByStep(prev => {
        const next = { ...prev };
        next[step] = latestId !== null && versionId === latestId;
        return next;
      });
      setIsManualEdit(true);
    },
    [blogCanvasVersionsByStep, resolvedCanvasStep, setIsManualEdit]
  );

  const handleCanvasStepChange = useCallback(
    (step: BlogStepId, options?: { skipManualUpdate?: boolean }) => {
      const { skipManualUpdate = false } = options ?? {};
      const versions = blogCanvasVersionsByStep[step] ?? [];
      const latestId = versions.length ? (versions[versions.length - 1]?.id ?? null) : null;

      setCanvasStep(step);
      setSelectedVersionByStep(prev => {
        const next = { ...prev };
        const current = next[step];
        const exists = current ? versions.some(version => version.id === current) : false;
        if (!exists) {
          next[step] = latestId ?? null;
        }
        return next;
      });
      setFollowLatestByStep(prev => {
        const next = { ...prev };
        if (latestId && (next[step] === undefined || next[step])) {
          next[step] = true;
        } else if (next[step] === undefined) {
          next[step] = false;
        }
        return next;
      });
      if (!skipManualUpdate) {
        setManualSelectedStep(step);
        const key = `blog_creation_${step}` as keyof typeof BLOG_PLACEHOLDERS;
        setPlaceholderOverride(BLOG_PLACEHOLDERS[key] ?? '');
      }
      setIsManualEdit(true);
    },
    [blogCanvasVersionsByStep, setIsManualEdit]
  );

  // ステップ変更ハンドラ
  const handleStepChange = useCallback(
    (step: BlogStepId) => {
      setManualSelectedStep(step);
      const key = `blog_creation_${step}` as keyof typeof BLOG_PLACEHOLDERS;
      setPlaceholderOverride(BLOG_PLACEHOLDERS[key] ?? '');
      handleCanvasStepChange(step, { skipManualUpdate: true });
    },
    [handleCanvasStepChange]
  );

  const handleCanvasStepSelect = useCallback(
    (stepId: string) => {
      if (!isBlogStepId(stepId)) return;
      handleCanvasStepChange(stepId);
    },
    [handleCanvasStepChange]
  );

  const handleCanvasSelectionEdit = useCallback(
    async (payload: CanvasSelectionEditPayload): Promise<CanvasSelectionEditResult> => {
      if (canvasEditInFlightRef.current) {
        throw new Error('他のAI編集が進行中です。完了をお待ちください。');
      }

      canvasEditInFlightRef.current = true;
      setIsManualEdit(true);

      try {
        let editingModel = selectedModel;
        if (selectedModel === 'blog_creation') {
          const stepInfo = stepActionBarRef.current?.getCurrentStepInfo();
          const currentStep =
            manualSelectedStep ?? stepInfo?.currentStep ?? latestBlogStep ?? 'step1';
          editingModel = `blog_creation_${currentStep}`;
        }

        if (!editingModel) {
          editingModel = 'lp_improvement';
        }

        const instruction = payload.instruction.trim();
        const selectedText = payload.selectedText.trim();
        const isImprove = payload.action === 'improve';
        const systemPromptOverride = isImprove
          ? [
              '# ユーザーの指示に基づいて、選択範囲を編集しつつ文章全体を最適化してください。',
              '',
              '## 重要な指示',
              '- 選択範囲の編集内容が文章全体の流れや一貫性を損なわないように調整してください。',
              '- 必要に応じて、選択範囲外の部分も改善してください（表現の統一、接続詞の調整、冗長性の削除など）。',
              '- **文章全体を省略せずに必ず全文を出力してください。**',
              '- 通常のブログ記事と同じMarkdown形式で出力してください。',
              '',
              '## 選択範囲',
              '```',
              selectedText,
              '```',
              '',
              '## 文章全体（Markdown）',
              '```markdown',
              payload.canvasMarkdown ?? '',
              '```',
            ]
              .filter(Boolean)
              .join('\n')
          : undefined;

        const userPrompt = isImprove
          ? instruction
          : ['```', selectedText, '```', '', instruction].join('\n');

        await chatSession.actions.sendMessage(
          userPrompt,
          editingModel,
          systemPromptOverride ? { systemPrompt: systemPromptOverride } : undefined
        );

        // 通常のブログ作成と同じように、新しいメッセージがチャットに表示される
        // ユーザーはBlogPreviewTileをクリックしてCanvasを開く
        return { replacementHtml: '' };
      } catch (error) {
        console.error('Canvas selection edit failed:', error);
        throw error instanceof Error ? error : new Error('AI編集の処理に失敗しました');
      } finally {
        canvasEditInFlightRef.current = false;
      }
    },
    [chatSession.actions, latestBlogStep, manualSelectedStep, selectedModel, setIsManualEdit]
  );

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
            latestBlogStep,
            availableSteps,
            manualSelectedStep,
            stepActionBarRef,
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
            handleModelChange,
            handleStepChange,
            placeholderOverride,
            nextStepForPlaceholder,
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
            onSelectionEdit={handleCanvasSelectionEdit}
            versions={canvasVersionsWithMeta}
            activeVersionId={activeCanvasVersion?.id ?? null}
            onVersionSelect={handleCanvasVersionSelect}
            stepOptions={canvasStepOptions}
            activeStepId={resolvedCanvasStep ?? null}
            onStepSelect={handleCanvasStepSelect}
          />
        )}
      </div>
    </BlogFlowProvider>
  );
};
