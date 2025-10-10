/**
 * フック専用の型定義
 */
import type { SubscriptionStatus as DomainSubscriptionStatus } from '../domain/interfaces/ISubscriptionService';
import type { ChatState } from '../domain/models/chat.models';
import type { getLineProfileServerResponse } from '../server/handler/actions/login.actions';

/**
 * LIFF フック関連
 */
export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export interface UseLiffResult {
  isLoggedIn: boolean;
  isLoading: boolean;
  error: string | null;
  liffObject: unknown | null;
  profile: LiffProfile | null;
  login: () => void;
  logout: () => void;
  getLineProfile: () => Promise<getLineProfileServerResponse>;
  getAccessToken: () => Promise<string>;
  initLiff: () => Promise<void>;
  clearError: () => void;
}

/**
 * サブスクリプション フック関連
 */
export interface SubscriptionHook {
  subscriptionStatus: DomainSubscriptionStatus | null;
  isLoading: boolean;
  requiresSubscription: boolean;
  hasActiveSubscription: boolean;
  error: string | null;
  actions: {
    checkSubscription: () => Promise<void>;
    refreshSubscription: () => Promise<void>;
    clearError: () => void;
    resetInitialization: () => void;
  };
}

/**
 * モバイル検出フック関連
 */
export interface UseMobileResult {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  orientation: 'portrait' | 'landscape';
}

/**
 * チャットセッション フック関連
 */
export interface ChatSessionActions {
  sendMessage: (
    content: string,
    model: string,
    options?: { systemPrompt?: string }
  ) => Promise<void>;
  loadSessions: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  startNewSession: () => void;
}

export interface ChatSessionHook {
  state: ChatState;
  actions: ChatSessionActions;
}
