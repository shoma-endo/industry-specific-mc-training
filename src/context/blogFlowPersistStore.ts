import { create, StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BlogStepId } from '@/lib/constants';
import type { FlowStatus } from './BlogFlowProvider';

type BlogFlowSessionState = {
  current?: BlogStepId | undefined;
  flowStatus?: FlowStatus | undefined;
  aiMessageId?: string | undefined;
};

type Store = {
  sessions: Record<string, BlogFlowSessionState>;
  setFor: (sessionId: string, partial: Partial<BlogFlowSessionState>) => void;
  getFor: (sessionId: string) => BlogFlowSessionState | undefined;
  clearFor: (sessionId: string) => void;
  clearAll: () => void;
};

const creator: StateCreator<Store, [], [['zustand/persist', Partial<Store>]]> = (set, get) => ({
  sessions: {},
  setFor: (sessionId, partial) =>
    set(state => ({
      sessions: {
        ...state.sessions,
        [sessionId]: { ...(state.sessions[sessionId] ?? {}), ...partial },
      },
    })),
  getFor: (sessionId: string) => get().sessions[sessionId],
  clearFor: (sessionId: string) =>
    set(state => {
      const rest = { ...state.sessions };
      delete rest[sessionId];
      return { sessions: rest };
    }),
  clearAll: () => set({ sessions: {} }),
});

export const useBlogFlowPersist = create<Store>()(
  persist(creator, {
    name: 'blog-flow-persist',
    version: 2,
    partialize: state => ({ sessions: state.sessions }),
  })
);
