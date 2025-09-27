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
import SessionSidebar from './SessionSidebar';
import MessageArea from './MessageArea';
import InputArea from './InputArea';
import CanvasPanel from './CanvasPanel';
import type { CanvasSelectionEditPayload, CanvasSelectionEditResult } from '@/types/canvas';
import AnnotationPanel from './AnnotationPanel';
import StepActionBar, { StepActionBarRef } from './StepActionBar';
import { getContentAnnotationBySession } from '@/server/handler/actions/wordpress.action';
import { BlogFlowProvider, useBlogFlow } from '@/context/BlogFlowProvider';
import { BlogStepId, BLOG_STEP_IDS } from '@/lib/constants';

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

const BLOG_MODEL_PREFIX = 'blog_creation_';

const isBlogStepId = (value: string): value is BlogStepId =>
  BLOG_STEP_IDS.includes(value as BlogStepId);

const extractBlogStepFromModel = (model?: string): BlogStepId | null => {
  if (!model || !model.startsWith(BLOG_MODEL_PREFIX)) return null;
  const candidate = model.slice(BLOG_MODEL_PREFIX.length);
  return isBlogStepId(candidate) ? candidate : null;
};

const findLatestAssistantBlogStep = (messages: ChatMessage[]): BlogStepId | null => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (!message || message.role !== 'assistant') continue;
    const step = extractBlogStepFromModel(message.model);
    if (step) return step;
  }
  return null;
};

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
  handleModelChange: (model: string, step?: BlogStepId) => void;
  handleStepChange: (step: BlogStepId) => void;
  handleRevisionClick: () => void;
  handleStepSelect: (step: BlogStepId) => void;
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
    handleRevisionClick,
    handleStepSelect,
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

  useEffect(() => {
    // 新しいアシスタントの返信が届いたら、修正モードを解除してステップアクションを再び有効化する
    const messages = chatSession.state.messages ?? [];
    const assistants = messages.filter(m => m.role === 'assistant');
    const lastAssistantId = assistants[assistants.length - 1]?.id;

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
  }, [chatSession.state.messages, state.flowStatus, cancelRevision]);

  const renderAfterMessage = (message: ChatMessage) => {
    // 最新のアシスタントメッセージIDを取得（ID比較で統一）
    const assistants = chatSession.state.messages.filter(m => m.role === 'assistant');
    const lastAssistantId = assistants[assistants.length - 1]?.id;

    // StepActionBar表示条件: ブログフロー中 かつ アクション待ち かつ 最新のAIメッセージ直下
    const shouldShowActionBar =
      effectiveBlogFlowActive &&
      state.flowStatus !== 'error' &&
      !chatSession.state.isLoading &&
      message.role === 'assistant' &&
      message.id === lastAssistantId;

    if (shouldShowActionBar) {
      return (
        <StepActionBar
          ref={stepActionBarRef}
          step={displayStep}
          hasDetectedBlogStep={hasDetectedBlogStep}
          className="px-3 py-2 border-t bg-gray-50/50"
          disabled={chatSession.state.isLoading || ui.annotation.loading}
          availableSteps={availableSteps}
          onStepChange={handleStepChange}
          selectedStep={manualSelectedStep}
          onRevisionClick={handleRevisionClick}
          onStepSelect={handleStepSelect}
          onSaveClick={() => ui.annotation.openWith(message.content)}
          annotationLoading={ui.annotation.loading}
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
          renderAfterMessage={renderAfterMessage}
          blogFlowActive={effectiveBlogFlowActive}
          onOpenCanvas={content => ui.canvas.show(content)}
        />

        <InputArea
          onSendMessage={onSendMessage}
          disabled={chatSession.state.isLoading || ui.annotation.loading}
          currentSessionTitle={
            chatSession.state.sessions.find(s => s.id === chatSession.state.currentSessionId)
              ?.title || '新しいチャット'
          }
          isMobile={isMobile}
          onMenuToggle={isMobile ? () => ui.sidebar.setOpen(!ui.sidebar.open) : undefined}
          blogFlowActive={effectiveBlogFlowActive}
          blogProgress={{ currentIndex: displayIndex, total: totalSteps }}
          onModelChange={handleModelChange}
          blogFlowStatus={state.flowStatus}
          selectedModelExternal={selectedModel}
          manualSelectedStep={manualSelectedStep}
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
  const [manualSelectedStep, setManualSelectedStep] = useState<BlogStepId | null>(null);
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

  // 利用可能なステップを計算（最新AIメッセージのステップまで）
  const availableSteps = useMemo(() => {
    if (!latestBlogStep) return [];
    const latestIndex = BLOG_STEP_IDS.indexOf(latestBlogStep);
    if (latestIndex === -1) return [];
    return BLOG_STEP_IDS.slice(0, latestIndex + 1);
  }, [latestBlogStep]);

  // 履歴ベースのモデル自動検出は削除（InputArea 側でフロー状態から自動選択）

  // ステップ変更ハンドラ
  const handleStepChange = useCallback((step: BlogStepId) => {
    setManualSelectedStep(step);
  }, []);

  // StepActionBarのrefを定義
  const stepActionBarRef = useRef<StepActionBarRef>(null);

  // StepActionBarのnextStep情報を更新する関数
  const updateNextStepInfo = useCallback(() => {
    if (stepActionBarRef.current) {
      const stepInfo = stepActionBarRef.current.getCurrentStepInfo();
      setNextStepForPlaceholder(stepInfo.nextStep);
    }
  }, []);

  // StepActionBarのイベントハンドラ
  const handleRevisionClick = useCallback(() => {
    setPlaceholderOverride('修正指示を入力してください');
  }, []);

  const handleStepSelect = useCallback((step: BlogStepId) => {
    const key = `blog_creation_${step}` as const;
    const placeholders = {
      blog_creation_step1: '顕在/潜在ニーズの内容を入力してください',
      blog_creation_step2: '想定ペルソナ/デモグラの内容を入力してください',
      blog_creation_step3: 'ユーザーのゴールに関する内容を入力してください',
      blog_creation_step4: 'PREP（主張・理由・具体例・結論）の確認事項を入力してください',
      blog_creation_step5: '構成案確認内容を入力してください',
      blog_creation_step6: '書き出し案を入力してください',
      blog_creation_step7: '本文作成の要件/トーンを入力してください',
    };
    setPlaceholderOverride(placeholders[key] || '');
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

  const parseCanvasEditResponse = useCallback((raw: string): CanvasSelectionEditResult => {
    const trimmed = raw.trim();
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/i);
    const inner = fencedMatch?.[1];
    const jsonCandidate = (typeof inner === 'string' && inner.length > 0 ? inner : trimmed).trim();
    if (!jsonCandidate) {
      throw new Error('AI応答を解析できませんでした');
    }

    const start = jsonCandidate.indexOf('{');
    const end = jsonCandidate.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) {
      throw new Error('AI応答を解析できませんでした');
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonCandidate.slice(start, end + 1));
    } catch (error) {
      console.error('Failed to parse canvas edit JSON:', error, jsonCandidate);
      throw new Error('AI応答のJSON解析に失敗しました');
    }

    const replacement = String(parsed.replacement_html ?? parsed.replacement ?? '').trim();
    if (!replacement) {
      throw new Error('replacement_html が空でした');
    }

    if (/<script\b/i.test(replacement) || /<iframe\b/i.test(replacement)) {
      throw new Error('安全でないHTMLタグが含まれています');
    }

    const explanationValue = parsed.explanation;
    const explanation =
      typeof explanationValue === 'string' && explanationValue.trim().length > 0
        ? explanationValue.trim()
        : undefined;

    const result: CanvasSelectionEditResult = {
      replacementHtml: replacement,
    };

    if (explanation) {
      return { ...result, explanation };
    }

    return result;
  }, []);

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

    // 最新のAIメッセージを取得してCanvasパネルを開く
    const latestAIMessage = getLatestAIMessage(chatSession.state.messages);
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
  const handleShowCanvas = (content: string) => {
    setCanvasContent(content);
    setIsManualEdit(true); // 手動編集フラグを立てて自動更新をスキップ

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

  const handleCanvasSelectionEdit = useCallback(
    async (payload: CanvasSelectionEditPayload): Promise<CanvasSelectionEditResult> => {
      if (canvasEditInFlightRef.current) {
        throw new Error('他のAI編集が進行中です。完了をお待ちください。');
      }

      canvasEditInFlightRef.current = true;
      setIsManualEdit(true);

      try {
        const beforeMessages = (chatStateRef.current.messages ?? []).filter(
          message => message.role === 'assistant'
        );
        const prevLastId = beforeMessages[beforeMessages.length - 1]?.id;
        const prevCount = beforeMessages.length;

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
          ? ['# ユーザーの指示に基づいて以下の内容を修正してください。省略しないで全文を必ず出してください。', payload.canvasMarkdown]
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

        const newMessageId = await waitForNewAssistantMessage(
          prevLastId,
          prevCount,
          () => chatStateRef.current.messages ?? [],
          20000,
          150
        );

        if (!newMessageId) {
          throw new Error('AIからの応答がタイムアウトしました');
        }

        const assistantMessages = (chatStateRef.current.messages ?? []).filter(
          message => message.role === 'assistant'
        );
        const targetMessage = assistantMessages.find(message => message.id === newMessageId);

        if (!targetMessage) {
          throw new Error('AI応答を取得できませんでした');
        }

        return parseCanvasEditResponse(targetMessage.content || '');
      } catch (error) {
        console.error('Canvas selection edit failed:', error);
        throw error instanceof Error ? error : new Error('AI編集の処理に失敗しました');
      } finally {
        canvasEditInFlightRef.current = false;
      }
    },
    [
      chatSession.actions,
      latestBlogStep,
      manualSelectedStep,
      parseCanvasEditResponse,
      selectedModel,
      setIsManualEdit,
      waitForNewAssistantMessage,
    ]
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
            handleRevisionClick,
            handleStepSelect,
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
          />
        )}
      </div>
    </BlogFlowProvider>
  );
};
