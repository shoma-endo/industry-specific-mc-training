'use client';
import React, { createContext, useContext, useMemo } from 'react';
import { BLOG_STEP_IDS, BlogStepId } from '@/lib/constants';

export type FlowStatus = 'idle' | 'running' | 'waitingAction' | 'error';

export interface BlogFlowState {
  current: BlogStepId;
  flowStatus: FlowStatus;
}

export interface BlogFlowContextValue {
  state: BlogFlowState;
  currentIndex: number;
  totalSteps: number;
}

type ProviderProps = {
  children: React.ReactNode;
};

const BlogFlowContext = createContext<BlogFlowContextValue | null>(null);

export const BlogFlowProvider: React.FC<ProviderProps> = ({ children }) => {
  const steps = BLOG_STEP_IDS;
  const resolvedInitialStep: BlogStepId = BLOG_STEP_IDS[0] as BlogStepId;
  const state = useMemo<BlogFlowState>(
    () => ({
      current: resolvedInitialStep,
      flowStatus: 'idle',
    }),
    [resolvedInitialStep]
  );

  const value = useMemo<BlogFlowContextValue>(() => {
    const currentIndex = steps.indexOf(state.current);
    return {
      state,
      currentIndex,
      totalSteps: steps.length,
    };
  }, [state, steps]);

  return <BlogFlowContext.Provider value={value}>{children}</BlogFlowContext.Provider>;
};

export const useBlogFlow = () => {
  const ctx = useContext(BlogFlowContext);
  if (!ctx) throw new Error('useBlogFlow must be used within BlogFlowProvider');
  return ctx;
};
