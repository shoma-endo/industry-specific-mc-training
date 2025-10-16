'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChatSessionHook } from '@/hooks/useChatSession';
import { SubscriptionHook } from '@/hooks/useSubscriptionStatus';
import { useLiffContext } from '@/components/LiffProvider';
import { ChatMessage } from '@/domain/interfaces/IChatService';
import { Button } from '@/components/ui/button';
import { AlertCircle, Menu } from 'lucide-react';
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
import { BlogStepId, BLOG_STEP_IDS } from '@/lib/constants';

interface ChatLayoutProps {
  chatSession: ChatSessionHook;
  subscription: SubscriptionHook;
  isMobile?: boolean;
}

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
  optimisticMessages: ChatMessage[];
  isCanvasStreaming: boolean;
  selectedModel: string;
  latestBlogStep: BlogStepId | null;
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
  nextStepForPlaceholder: BlogStepId | null;
  onNextStepChange: (nextStep: BlogStepId | null) => void;
};

const ChatLayoutContent: React.FC<{ ctx: ChatLayoutCtx }> = ({ ctx }) => {
  const {
    chatSession,
    subscription,
    isMobile,
    blogFlowActive,
    optimisticMessages,
    isCanvasStreaming,
    selectedModel,
    latestBlogStep,
    stepActionBarRef,
    ui,
    onSendMessage,
    handleModelChange,
    nextStepForPlaceholder,
  } = ctx;
  const router = useRouter();

  const currentStep: BlogStepId = BLOG_STEP_IDS[0] as BlogStepId;
  const flowStatus: 'idle' | 'running' | 'waitingAction' | 'error' = 'idle';
  // 最新メッセージのステップを優先し、なければ初期ステップにフォールバック
  const displayStep = latestBlogStep ?? currentStep;
  const hasDetectedBlogStep = latestBlogStep !== null;
  const displayIndex = useMemo(() => {
    const index = BLOG_STEP_IDS.indexOf(displayStep);
    return index >= 0 ? index : 0;
  }, [displayStep]);

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

  const shouldShowStepActionBar =
    blogFlowActive &&
    !chatSession.state.isLoading &&
    !!lastAssistantMessage &&
    hasDetectedBlogStep;

  return (
    <>
      {/* デスクトップサイドバー */}
      {!isMobile && (
        <SessionSidebar
          sessions={chatSession.state.sessions}
          currentSessionId={chatSession.state.currentSessionId}
          actions={chatSession.actions}
          isLoading={chatSession.state.isLoading}
          isMobile={false}
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
              isMobile
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
          messages={[...chatSession.state.messages, ...optimisticMessages]}
          isLoading={chatSession.state.isLoading || isCanvasStreaming}
          blogFlowActive={blogFlowActive}
          onOpenCanvas={message => ui.canvas.show(message)}
        />

        <InputArea
          onSendMessage={onSendMessage}
          disabled={chatSession.state.isLoading || ui.annotation.loading}
          shouldShowStepActionBar={shouldShowStepActionBar}
          stepActionBarRef={stepActionBarRef}
          displayStep={displayStep}
          hasDetectedBlogStep={hasDetectedBlogStep}
          onSaveClick={() => ui.annotation.openWith()}
          annotationLoading={ui.annotation.loading}
          stepActionBarDisabled={chatSession.state.isLoading || ui.annotation.loading}
          currentSessionTitle={
            chatSession.state.sessions.find(s => s.id === chatSession.state.currentSessionId)
              ?.title || '新しいチャット'
          }
          currentSessionId={chatSession.state.currentSessionId}
          isMobile={isMobile}
          onMenuToggle={isMobile ? () => ui.sidebar.setOpen(!ui.sidebar.open) : undefined}
          blogFlowActive={blogFlowActive}
          blogProgress={{ currentIndex: displayIndex, total: BLOG_STEP_IDS.length }}
          onModelChange={handleModelChange}
          blogFlowStatus={flowStatus}
          selectedModelExternal={selectedModel}
          nextStepForPlaceholder={nextStepForPlaceholder}
          onNextStepChange={ctx.onNextStepChange}
          {...(latestBlogStep ? { initialBlogStep: latestBlogStep } : {})}
        />
      </div>

      {ui.annotation.open && (
        <AnnotationPanel
          sessionId={chatSession.state.currentSessionId || ''}
          initialData={ui.annotation.data}
          onClose={() => {
            ui.annotation.setOpen(false);
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
  isMobile = false,
}) => {
  const { getAccessToken } = useLiffContext();
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
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [, setSelectedBlogStep] = useState<BlogStepId>('step1');
  const [selectedVersionByStep, setSelectedVersionByStep] = useState<
    Partial<Record<BlogStepId, string | null>>
  >({});
  const [followLatestByStep, setFollowLatestByStep] = useState<
    Partial<Record<BlogStepId, boolean>>
  >({});
  const [nextStepForPlaceholder, setNextStepForPlaceholder] = useState<BlogStepId | null>(null);
  const [canvasStreamingContent, setCanvasStreamingContent] = useState<string>('');
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const [isCanvasStreaming, setIsCanvasStreaming] = useState(false);
  const latestBlogStep = useMemo(
    () => findLatestAssistantBlogStep(chatSession.state.messages ?? []),
    [chatSession.state.messages]
  );

  // 保存済みステップを計算（保存されているフィールドから判断）
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
        } else {
          setAnnotationData(null);
        }
      } catch (error) {
        console.error('Failed to preload annotation data:', error);
      }
    };

    loadAnnotations();

    return () => {
      isActive = false;
    };
  }, [chatSession.state.currentSessionId]);

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
    if (latestBlogStep) return latestBlogStep;
    return null;
  }, [canvasStep, latestBlogStep]);

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
      BLOG_STEP_IDS.filter(
        step => (blogCanvasVersionsByStep[step] ?? []).length > 0 && step !== nextStepForPlaceholder
      ),
    [blogCanvasVersionsByStep, nextStepForPlaceholder]
  );

  // 履歴ベースのモデル自動検出は削除（InputArea 側でフロー状態から自動選択）

  // StepActionBarのrefを定義
  const stepActionBarRef = useRef<StepActionBarRef>(null);

  // モデル変更ハンドラ
  const handleModelChange = useCallback((model: string, step?: BlogStepId) => {
    setSelectedModel(model);
    if (step) setSelectedBlogStep(step);
  }, []);

  // nextStepの変更ハンドラ
  const handleNextStepChange = useCallback((nextStep: BlogStepId | null) => {
    setNextStepForPlaceholder(nextStep);
  }, []);

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
    setNextStepForPlaceholder(null);
    // セッション切り替え時はモデル選択もリセット（後続のuseEffectで復元される）
    setSelectedModel('');
  }, [chatSession.state.currentSessionId]);

  // ✅ メッセージ履歴にブログステップがある場合、自動的にブログ作成モデルを選択
  // セッション切り替え後、latestBlogStepが確定してから実行される
  useEffect(() => {
    // ブログステップが検出された場合
    if (latestBlogStep) {
      // モデルが未選択、またはすでにブログ作成モデルの場合のみ自動選択
      // （ユーザーが明示的に他のモデルを選択した場合は尊重）
      if (!selectedModel || selectedModel === 'blog_creation') {
        setSelectedModel('blog_creation');
        setSelectedBlogStep(latestBlogStep);
      }
    }
  }, [latestBlogStep, selectedModel]);

  // ✅ メッセージ送信時に初期化を実行
  const handleSendMessage = async (content: string, model: string) => {
    // 新規メッセージ送信時は手動編集フラグをリセット
    setIsManualEdit(false);
    setNextStepForPlaceholder(null);
    // メッセージ送信（エラーハンドリングは上位に委譲）
    await chatSession.actions.sendMessage(content, model);
  };

  // ✅ Canvasボタンクリック時にCanvasPanelを表示する関数
  const handleShowCanvas = useCallback(
    (message: ChatMessage) => {
      const fallbackStep = (latestBlogStep ?? BLOG_STEP_IDS[0]) as BlogStepId;
      const detectedStep = (extractBlogStepFromModel(message.model) ?? fallbackStep) as BlogStepId;
      const versions = blogCanvasVersionsByStep[detectedStep] ?? [];
      const latestVersionId = versions.length ? (versions[versions.length - 1]?.id ?? null) : null;
      const hasExactMatch = versions.some(version => version.id === message.id);
      const targetVersionId = hasExactMatch ? message.id : latestVersionId;

      if (message.id.startsWith('temp-assistant-')) {
        const normalizedStreaming = normalizeCanvasContent(message.content ?? '');
        if (normalizedStreaming) {
          setCanvasStreamingContent(normalizedStreaming);
        }
      } else {
        setCanvasStreamingContent('');
      }

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
    [
      annotationOpen,
      blogCanvasVersionsByStep,
      latestBlogStep,
      setCanvasStreamingContent,
      setIsManualEdit,
    ]
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
    (step: BlogStepId) => {
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
      setIsManualEdit(true);
    },
    [blogCanvasVersionsByStep, setIsManualEdit]
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
      setIsCanvasStreaming(true);

      try {
        // キャンバスパネルはブログ作成専用のため、常にブログ作成モデルを使用
        let targetStep: BlogStepId;

        // Canvasで選択されているステップを優先（過去のステップからの改善に対応）
        if (resolvedCanvasStep) {
          targetStep = resolvedCanvasStep;
        } else {
          const stepInfo = stepActionBarRef.current?.getCurrentStepInfo();
          targetStep = stepInfo?.currentStep ?? latestBlogStep ?? 'step1';
        }

        const instruction = payload.instruction.trim();
        const selectedText = payload.selectedText.trim();

        // canvasContentの検証
        if (!payload.canvasContent || payload.canvasContent.trim() === '') {
          throw new Error('キャンバスコンテンツが空です。編集対象が見つかりませんでした。');
        }

        // セッションIDの検証
        if (!chatSession.state.currentSessionId) {
          throw new Error('セッションIDが見つかりません');
        }

        // アクセストークン取得
        const accessToken = await getAccessToken();

        // ストリーミングコンテンツをリセット
        setCanvasStreamingContent('');

        // ✅ 楽観的更新: ストリーミング開始時にメッセージを追加してBlogPreviewTileを表示
        const tempAssistantId = `temp-assistant-${Date.now()}`;
        const userMessage: ChatMessage = {
          id: `temp-user-${Date.now()}`,
          role: 'user',
          content: instruction,
          timestamp: new Date(),
          model: `blog_creation_${targetStep}`,
        };

        const assistantMessage: ChatMessage = {
          id: tempAssistantId,
          role: 'assistant',
          content: '', // ストリーミング中は空
          timestamp: new Date(),
          model: `blog_creation_${targetStep}`,
        };

        setOptimisticMessages([userMessage, assistantMessage]);

        if (annotationOpen) {
          setAnnotationOpen(false);
          setAnnotationData(null);
        }

        setCanvasStep(targetStep);
        setSelectedVersionByStep(prev => ({
          ...prev,
          [targetStep]: null,
        }));
        setFollowLatestByStep(prev => ({
          ...prev,
          [targetStep]: false,
        }));
        setCanvasStreamingContent('');
        setCanvasPanelOpen(true);

        // ✅ ストリーミングAPI呼び出し（Web検索を有効化）
        const response = await fetch('/api/chat/canvas/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            sessionId: chatSession.state.currentSessionId,
            instruction,
            selectedText,
            canvasContent: payload.canvasContent,
            targetStep,
            enableWebSearch: true,
            webSearchConfig: {
              maxUses: 3,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`ストリーミングAPIエラー: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('ストリーミングレスポンスの取得に失敗しました');
        }

        let buffer = '';
        let fullMarkdown = '';
        let searchQuery = '';
        let searchResultsCount = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim() || line.startsWith(': ')) continue;

            const eventMatch = line.match(/^event: (.+)$/m);
            const dataMatch = line.match(/^data: (.+)$/m);

            if (!eventMatch || !dataMatch || !eventMatch[1] || !dataMatch[1]) continue;

            const eventType = eventMatch[1];
            const eventData = JSON.parse(dataMatch[1]);

            if (eventType === 'search_query') {
              searchQuery = eventData.query || '';
              console.log('[Canvas] Search query:', searchQuery);
            } else if (eventType === 'search_complete') {
              searchResultsCount = eventData.resultsCount || 0;
              console.log('[Canvas] Search completed. Results count:', searchResultsCount);
              // 検索情報をストリーミングコンテンツの先頭に追加
              const searchInfo = `🔍 **検索クエリ**: ${searchQuery}\n📊 **検索結果数**: ${searchResultsCount}件\n\n---\n\n`;
              fullMarkdown = searchInfo + fullMarkdown;
              setCanvasStreamingContent(fullMarkdown);
            } else if (eventType === 'chunk') {
              fullMarkdown += eventData.content;
              setCanvasStreamingContent(fullMarkdown);
              // アシスタントメッセージのコンテンツを更新
              setOptimisticMessages(prev =>
                prev.map(msg => (msg.id === tempAssistantId ? { ...msg, content: fullMarkdown } : msg))
              );
            } else if (eventType === 'done') {
              fullMarkdown = eventData.fullMarkdown || fullMarkdown;
              setCanvasStreamingContent(fullMarkdown);
              // アシスタントメッセージのコンテンツを更新
              setOptimisticMessages(prev =>
                prev.map(msg => (msg.id === tempAssistantId ? { ...msg, content: fullMarkdown } : msg))
              );
            } else if (eventType === 'error') {
              throw new Error(eventData.message || 'ストリーミングエラーが発生しました');
            }
          }
        }

        // 改善指示を出したステップから続行できるように状態を更新
        setSelectedBlogStep(targetStep);
        handleModelChange('blog_creation', targetStep);

        // セッションを再読み込みして最新メッセージを取得
        await chatSession.actions.loadSession(chatSession.state.currentSessionId);

        // 楽観的更新をクリア（実際のメッセージで置き換え）
        setOptimisticMessages([]);

        // 通常のブログ作成と同じように、新しいメッセージがチャットに表示される
        // ユーザーはBlogPreviewTileをクリックしてCanvasを開く
        return { replacementHtml: '' };
      } catch (error) {
        console.error('Canvas selection edit failed:', error);
        // エラー時も楽観的更新をクリア
        setOptimisticMessages([]);
        throw error instanceof Error ? error : new Error('AI編集の処理に失敗しました');
      } finally {
        canvasEditInFlightRef.current = false;
        setCanvasStreamingContent('');
        setIsCanvasStreaming(false);
      }
    },
    [
      annotationOpen,
      chatSession.actions,
      chatSession.state.currentSessionId,
      getAccessToken,
      handleModelChange,
      latestBlogStep,
      resolvedCanvasStep,
      setAnnotationData,
      setAnnotationOpen,
      setCanvasPanelOpen,
      setCanvasStep,
      setFollowLatestByStep,
      setIsManualEdit,
      setOptimisticMessages,
      setCanvasStreamingContent,
      setSelectedVersionByStep,
    ]
  );

  return (
    <div className="flex h-[calc(100vh-3rem)]" data-testid="chat-layout">
      <ChatLayoutContent
        ctx={{
          chatSession,
          subscription,
          isMobile,
          blogFlowActive,
          optimisticMessages,
          isCanvasStreaming,
          selectedModel,
          latestBlogStep,
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
          nextStepForPlaceholder,
          onNextStepChange: handleNextStepChange,
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
          streamingContent={canvasStreamingContent}
        />
      )}
    </div>
  );
};
