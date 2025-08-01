'use server';

import { authMiddleware } from '@/server/middleware/auth.middleware';
import { chatService } from '@/server/services/chatService';
import { ChatResponse } from '@/types/chat';
import { ModelHandlerService } from './chat/modelHandlers';
import { canUseServices } from '@/lib/auth-utils';
import { userService } from '@/server/services/userService';
import {
  startChatSchema,
  continueChatSchema,
  type StartChatInput,
  type ContinueChatInput,
} from './shared/validators';

const modelHandler = new ModelHandlerService();

// 認証チェックを共通化
async function checkAuth(liffAccessToken: string) {
  const authResult = await authMiddleware(liffAccessToken);
  if (authResult.error || authResult.requiresSubscription) {
    return {
      isError: true as const,
      error: authResult.error,
      requiresSubscription: authResult.requiresSubscription,
    };
  }

  // unavailableユーザーのサービス利用制限チェック
  try {
    const user = await userService.getUserFromLiffToken(liffAccessToken);
    if (user && !canUseServices(user.role)) {
      return {
        isError: true as const,
        error: 'サービスの利用が停止されています',
        requiresSubscription: false,
      };
    }
  } catch (error) {
    console.error('User role check failed in checkAuth:', error);
    return {
      isError: true as const,
      error: 'ユーザー情報の確認に失敗しました',
      requiresSubscription: false,
    };
  }

  return { isError: false as const, userId: authResult.userId! };
}

export async function startChat(data: StartChatInput): Promise<ChatResponse> {
  try {
    const validatedData = startChatSchema.parse(data);

    // 認証チェック
    const auth = await checkAuth(validatedData.liffAccessToken);
    if (auth.isError) {
      return {
        message: '',
        error: auth.error,
        requiresSubscription: auth.requiresSubscription,
      };
    }

    // モデル処理に委譲
    return await modelHandler.handleStart(auth.userId, validatedData);
  } catch (e: unknown) {
    console.error('startChat failed:', e);
    return {
      message: '',
      error: (e as Error).message || '予期せぬエラーが発生しました',
      requiresSubscription: false,
    };
  }
}

export async function continueChat(data: ContinueChatInput): Promise<ChatResponse> {
  try {
    const validatedData = continueChatSchema.parse(data);

    // 認証チェック
    const auth = await checkAuth(validatedData.liffAccessToken);
    if (auth.isError) {
      return {
        message: '',
        error: auth.error,
        requiresSubscription: auth.requiresSubscription,
      };
    }

    // モデル処理に委譲
    return await modelHandler.handleContinue(auth.userId, validatedData);
  } catch (e: unknown) {
    console.error('continueChat failed:', e);
    return {
      message: '',
      error: (e as Error).message || '予期せぬエラーが発生しました',
      requiresSubscription: false,
    };
  }
}

export async function getChatSessions(liffAccessToken: string) {
  const auth = await checkAuth(liffAccessToken);
  if (auth.isError) {
    return { sessions: [], error: auth.error, requiresSubscription: auth.requiresSubscription };
  }
  const sessions = await chatService.getUserSessions(auth.userId);
  return { sessions, error: null };
}

export async function getSessionMessages(sessionId: string, liffAccessToken: string) {
  const auth = await checkAuth(liffAccessToken);
  if (auth.isError) {
    return { messages: [], error: auth.error, requiresSubscription: auth.requiresSubscription };
  }
  const messages = await chatService.getSessionMessages(sessionId, auth.userId);
  return { messages, error: null };
}

export async function deleteChatSession(sessionId: string, liffAccessToken: string) {
  const auth = await checkAuth(liffAccessToken);
  if (auth.isError) {
    return { success: false, error: auth.error, requiresSubscription: auth.requiresSubscription };
  }

  try {
    await chatService.deleteChatSession(sessionId, auth.userId);
    return { success: true, error: null };
  } catch (error) {
    console.error('Failed to delete chat session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'チャットセッションの削除に失敗しました',
    };
  }
}

// === Server Action aliases (for client-side import) ===
export const startChatSA = startChat;
export const continueChatSA = continueChat;
export const getChatSessionsSA = getChatSessions;
export const getSessionMessagesSA = getSessionMessages;
export const deleteChatSessionSA = deleteChatSession;
