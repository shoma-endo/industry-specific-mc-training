'use server';

import { authMiddleware } from '@/server/middleware/auth.middleware';
import { chatService } from '@/server/services/chatService';
import { ChatResponse } from '@/types/chat';
import { ModelHandlerService } from './chat/modelHandlers';
import { canUseServices } from '@/lib/auth-utils';
import { userService } from '@/server/services/userService';
import { SupabaseService } from '@/server/services/supabaseService';
import type { UserRole } from '@/types/user';
import { ERROR_MESSAGES } from '@/lib/constants';
import {
  startChatSchema,
  continueChatSchema,
  type StartChatInput,
  type ContinueChatInput,
} from './shared/validators';

const modelHandler = new ModelHandlerService();

// 認証チェックを共通化（ロールも返す）
async function checkAuth(
  liffAccessToken: string
): Promise<
  | { isError: true; error: string | undefined; requiresSubscription?: boolean }
  | { isError: false; userId: string; role: UserRole }
> {
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
    return { isError: false as const, userId: authResult.userId!, role: user?.role ?? 'user' };
  } catch (error) {
    console.error('User role check failed in checkAuth:', error);
    return {
      isError: true as const,
      error: 'ユーザー情報の確認に失敗しました',
      requiresSubscription: false,
    };
  }
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

    // 1日3回の送信制限（JST）: user 権限のみ適用
    if (auth.role === 'user') {
      const supabase = new SupabaseService();
      const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
      const nowUtc = new Date();
      const nowJst = new Date(nowUtc.getTime() + JST_OFFSET_MS);
      const startOfJstUtcMs = Date.UTC(
        nowJst.getUTCFullYear(),
        nowJst.getUTCMonth(),
        nowJst.getUTCDate(),
        0,
        0,
        0,
        0
      );
      const fromUtcMs = startOfJstUtcMs - JST_OFFSET_MS; // JST 00:00 を UTC に補正
      const toUtcMs = fromUtcMs + 24 * 60 * 60 * 1000;

      const sentCountToday = await supabase.countUserMessagesBetween(
        auth.userId,
        fromUtcMs,
        toUtcMs
      );
      if (sentCountToday >= 3) {
        return {
          message: '',
          error: ERROR_MESSAGES.daily_chat_limit,
          requiresSubscription: false,
        };
      }
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

    // 1日3回の送信制限（JST）: user 権限のみ適用
    if (auth.role === 'user') {
      const supabase = new SupabaseService();
      const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
      const nowUtc = new Date();
      const nowJst = new Date(nowUtc.getTime() + JST_OFFSET_MS);
      const startOfJstUtcMs = Date.UTC(
        nowJst.getUTCFullYear(),
        nowJst.getUTCMonth(),
        nowJst.getUTCDate(),
        0,
        0,
        0,
        0
      );
      const fromUtcMs = startOfJstUtcMs - JST_OFFSET_MS; // JST 00:00 を UTC に補正
      const toUtcMs = fromUtcMs + 24 * 60 * 60 * 1000;

      const sentCountToday = await supabase.countUserMessagesBetween(
        auth.userId,
        fromUtcMs,
        toUtcMs
      );
      if (sentCountToday >= 3) {
        return {
          message: '',
          error: ERROR_MESSAGES.daily_chat_limit,
          requiresSubscription: false,
        };
      }
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
