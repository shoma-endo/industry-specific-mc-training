'use client';
import React, { createContext, useContext, useState } from 'react';
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
  const [state] = useState<BlogFlowState>(() => {
    return {
      current: resolvedInitialStep,
      flowStatus: 'idle',
    };
  });

  const currentIndex = steps.indexOf(state.current);
  const totalSteps = steps.length;

  const value: BlogFlowContextValue = {
    state,
    currentIndex,
    totalSteps,
  };

  return <BlogFlowContext.Provider value={value}>{children}</BlogFlowContext.Provider>;
};

export const useBlogFlow = () => {
  const ctx = useContext(BlogFlowContext);
  if (!ctx) throw new Error('useBlogFlow must be used within BlogFlowProvider');
  return ctx;
};
