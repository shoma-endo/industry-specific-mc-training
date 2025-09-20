'use client';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { BLOG_STEP_IDS, BLOG_STEP_LABELS, BlogStepId, toTemplateName } from '@/lib/constants';
import { useBlogFlowPersist } from './blogFlowPersistStore';

export type FlowStatus = 'idle' | 'running' | 'waitingAction' | 'revising' | 'completed' | 'error';
export type StepStatus = 'pending' | 'ready' | 'done' | 'error';

export interface StepRun {
  step: BlogStepId;
  status: StepStatus;
  aiMessageId?: string;
  revisionNote?: string;
  createdAt: number;
  updatedAt: number;
}

export interface BlogFlowState {
  current: BlogStepId;
  steps: Record<BlogStepId, StepRun>;
  flowStatus: FlowStatus;
  error?: string;
}

export interface ChatAgent {
  send: (content: string, model: string) => Promise<{ messageId: string } | string>;
}

export interface CanvasController {
  open: () => void;
  close?: () => void;
}

export interface BlogFlowContextValue {
  state: BlogFlowState;
  isActive: boolean;
  currentIndex: number;
  totalSteps: number;
  start: () => Promise<void>;
  openRevision: () => void;
  applyRevision: (note: string) => Promise<void>;
  cancelRevision: () => void;
  reset: () => void;
}

type ProviderProps = {
  children: React.ReactNode;
  agent: ChatAgent;
  steps?: BlogStepId[];
  initialStep?: BlogStepId;
  getModelId?: (step: BlogStepId) => string;
  canvasController?: CanvasController;
  isActive?: boolean;
  sessionId: string;
};

const BlogFlowContext = createContext<BlogFlowContextValue | null>(null);

export const BlogFlowProvider: React.FC<ProviderProps> = ({
  children,
  agent,
  steps = BLOG_STEP_IDS,
  initialStep = BLOG_STEP_IDS[0],
  getModelId = toTemplateName,
  canvasController,
  isActive = true,
  sessionId,
}) => {
  const resolvedInitialStep: BlogStepId = initialStep ?? steps[0] ?? ('step1' as BlogStepId);
  const [state, setState] = useState<BlogFlowState>(() => {
    const now = Date.now();
    const initSteps = {} as Record<BlogStepId, StepRun>;
    steps.forEach(step => {
      initSteps[step] = { step, status: 'pending', createdAt: now, updatedAt: now };
    });
    return {
      current: resolvedInitialStep,
      steps: initSteps,
      flowStatus: 'idle',
    };
  });

  // persist store
  const persistStore = useBlogFlowPersist();

  // マウント時: セッション単位でpersistから初期同期（あるものだけ上書き）
  useEffect(() => {
    const saved = persistStore.getFor(sessionId);
    if (saved && (saved.current || saved.flowStatus || saved.aiMessageId)) {
      setState(prev => {
        const next = { ...prev };
        if (saved.current) next.current = saved.current;
        if (saved.flowStatus) next.flowStatus = saved.flowStatus;
        if (saved.current) {
          next.steps = {
            ...next.steps,
            [saved.current]: {
              ...next.steps[saved.current],
              aiMessageId: saved.aiMessageId ?? next.steps[saved.current]?.aiMessageId,
            },
          };
        }
        return next;
      });
    }
  }, [persistStore, sessionId]);

  // restoreFlowState は廃止（persistと実行時のrunStepに一本化）

  const runningRef = useRef(false);

  const currentIndex = steps.indexOf(state.current);
  const totalSteps = steps.length;

  const normalizeMessageId = (res: { messageId: string } | string) =>
    typeof res === 'string' ? res : res.messageId;

  const runStep = useCallback(
    async (step: BlogStepId, input: string | undefined) => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        setState(prev => ({
          ...prev,
          flowStatus: 'running',
          current: step,
          steps: {
            ...prev.steps,
            [step]: { ...prev.steps[step], updatedAt: Date.now() },
          },
        }));
        persistStore.setFor(sessionId, { current: step, flowStatus: 'running' });

        const model = getModelId(step);
        // inputがない場合は動的テンプレートメッセージを送信
        // ステップのラベルから「次の〇〇を出力してください」形式でメッセージを生成
        let content: string;
        if (input) {
          content = input;
        } else {
          const stepLabel = BLOG_STEP_LABELS[step];
          if (stepLabel) {
            // "1. 顕在ニーズ・潜在ニーズ確認" から "顕在ニーズ・潜在ニーズ確認" を抽出
            const labelContent = stepLabel.replace(/^\d+\.\s*/, '');
            content = `次の${labelContent}を出力してください`;
          } else {
            content = 'システムメッセージに従ってください';
          }
        }
        const res = await agent.send(content, model);
        const messageId = normalizeMessageId(res);

        const isLastStep = step === steps[steps.length - 1];
        setState(prev => ({
          ...prev,
          flowStatus: isLastStep ? 'completed' : 'waitingAction',
          steps: {
            ...prev.steps,
            [step]: {
              ...prev.steps[step],
              status: isLastStep ? 'done' : 'ready',
              aiMessageId: messageId,
              updatedAt: Date.now(),
            },
          },
        }));
        persistStore.setFor(sessionId, {
          current: step,
          flowStatus: isLastStep ? 'completed' : 'waitingAction',
          aiMessageId: messageId,
        });
      } catch (e: unknown) {
        setState(prev => ({
          ...prev,
          flowStatus: 'error',
          error: e instanceof Error ? e.message : 'unknown_error',
          steps: {
            ...prev.steps,
            [step]: { ...prev.steps[step], status: 'error', updatedAt: Date.now() },
          },
        }));
        persistStore.setFor(sessionId, { flowStatus: 'error' });
      } finally {
        runningRef.current = false;
      }
    },
    [agent, getModelId, steps, persistStore, sessionId]
  );

  const start = useCallback(async () => {
    if (!isActive || state.flowStatus !== 'idle') return;
    await runStep(resolvedInitialStep, '');
  }, [isActive, state.flowStatus, runStep, resolvedInitialStep]);

  // nextは廃止（ユーザー送信で進行）

  const openRevision = useCallback(() => {
    setState(prev => ({ ...prev, flowStatus: 'revising' }));
    persistStore.setFor(sessionId, { flowStatus: 'revising' });
    canvasController?.open?.();
  }, [canvasController, persistStore, sessionId]);

  const applyRevision = useCallback(
    async (note: string) => {
      if (state.flowStatus !== 'revising') return;
      const step = state.current;
      setState(prev => ({
        ...prev,
        steps: {
          ...prev.steps,
          [step]: {
            ...prev.steps[step],
            revisionNote: note,
            updatedAt: Date.now(),
          },
        },
      }));
      await runStep(step, note);
    },
    [runStep, state]
  );

  const cancelRevision = useCallback(() => {
    setState(prev =>
      prev.flowStatus === 'revising' ? { ...prev, flowStatus: 'waitingAction' } : prev
    );
    persistStore.setFor(sessionId, { flowStatus: 'waitingAction' });
    canvasController?.close?.();
  }, [canvasController, persistStore, sessionId]);

  const reset = useCallback(() => {
    const now = Date.now();
    const initSteps = {} as Record<BlogStepId, StepRun>;
    steps.forEach(step => {
      initSteps[step] = { step, status: 'pending', createdAt: now, updatedAt: now };
    });
    setState({ current: resolvedInitialStep, steps: initSteps, flowStatus: 'idle' });
    persistStore.clearFor(sessionId);
  }, [steps, resolvedInitialStep, persistStore, sessionId]);

  const value: BlogFlowContextValue = {
    state,
    isActive,
    currentIndex,
    totalSteps,
    start,
    openRevision,
    applyRevision,
    cancelRevision,
    reset,
  };

  return <BlogFlowContext.Provider value={value}>{children}</BlogFlowContext.Provider>;
};

export const useBlogFlow = () => {
  const ctx = useContext(BlogFlowContext);
  if (!ctx) throw new Error('useBlogFlow must be used within BlogFlowProvider');
  return ctx;
};
