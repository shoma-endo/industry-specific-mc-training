'use server';

import { authMiddleware } from '@/server/middleware/auth.middleware';
import { chatService } from '@/server/services/chatService';
import { ChatResponse } from '@/types/chat';
import { ModelHandlerService } from './chat/modelHandlers';
import { canUseServices } from '@/auth-utils';
import { userService } from '@/server/services/userService';
import type { UserRole } from '@/types/user';
import { z } from 'zod';
import { SupabaseService } from '@/server/services/supabaseService';

const startChatSchema = z.object({
  userMessage: z.string(),
  model: z.string(),
  liffAccessToken: z.string(),
  systemPrompt: z.string().optional(),
});

const continueChatSchema = z.object({
  sessionId: z.string(),
  messages: z.array(z.object({ role: z.string(), content: z.string() })),
  userMessage: z.string(),
  model: z.string(),
  liffAccessToken: z.string(),
  systemPrompt: z.string().optional(),
});

// メッセージ保存関連のスキーマ
const saveMessageSchema = z.object({
  messageId: z.string(),
  liffAccessToken: z.string(),
});

const unsaveMessageSchema = saveMessageSchema;

const getSavedIdsSchema = z.object({
  sessionId: z.string(),
  liffAccessToken: z.string(),
});

const updateChatSessionTitleSchema = z.object({
  sessionId: z.string(),
  title: z.string().min(1).max(60),
  liffAccessToken: z.string(),
});

export type StartChatInput = z.infer<typeof startChatSchema>;
export type ContinueChatInput = z.infer<typeof continueChatSchema>;

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
    return { isError: false as const, userId: authResult.userId!, role: user?.role ?? 'trial' };
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

export async function updateChatSessionTitle(
  sessionId: string,
  title: string,
  liffAccessToken: string
) {
  const parsed = updateChatSessionTitleSchema.parse({
    sessionId,
    title: title.trim(),
    liffAccessToken,
  });

  const auth = await checkAuth(parsed.liffAccessToken);
  if (auth.isError) {
    return { success: false, error: auth.error, requiresSubscription: auth.requiresSubscription };
  }

  const supabase = new SupabaseService();
  const updateResult = await supabase.updateChatSession(parsed.sessionId, auth.userId, {
    title: parsed.title.trim(),
  });

  if (!updateResult.success) {
    return { success: false, error: updateResult.error.userMessage };
  }

  return { success: true, error: null };
}

// === メッセージ保存関連のサーバーアクション ===

export async function saveMessage(data: z.infer<typeof saveMessageSchema>) {
  const { messageId, liffAccessToken } = saveMessageSchema.parse(data);
  const auth = await checkAuth(liffAccessToken);
  if (auth.isError) {
    return { success: false, error: auth.error, requiresSubscription: auth.requiresSubscription };
  }
  
  const supabase = new SupabaseService();
  const saveResult = await supabase.setMessageSaved(auth.userId, messageId, true);

  if (!saveResult.success) {
    return { success: false, error: saveResult.error.userMessage };
  }

  return { success: true };
}

export async function unsaveMessage(data: z.infer<typeof unsaveMessageSchema>) {
  const { messageId, liffAccessToken } = unsaveMessageSchema.parse(data);
  const auth = await checkAuth(liffAccessToken);
  if (auth.isError) {
    return { success: false, error: auth.error, requiresSubscription: auth.requiresSubscription };
  }
  
  const supabase = new SupabaseService();
  const unsaveResult = await supabase.setMessageSaved(auth.userId, messageId, false);

  if (!unsaveResult.success) {
    return { success: false, error: unsaveResult.error.userMessage };
  }

  return { success: true };
}

export async function getSavedMessageIds(data: z.infer<typeof getSavedIdsSchema>) {
  const { sessionId, liffAccessToken } = getSavedIdsSchema.parse(data);
  const auth = await checkAuth(liffAccessToken);
  if (auth.isError) {
    return { ids: [], error: auth.error, requiresSubscription: auth.requiresSubscription };
  }
  
  const supabase = new SupabaseService();
  const idsResult = await supabase.getSavedMessageIdsBySession(auth.userId, sessionId);

  if (!idsResult.success) {
    return {
      ids: [],
      error: idsResult.error.userMessage,
    };
  }

  return { ids: idsResult.data, error: null };
}

export async function getAllSavedMessages(liffAccessToken: string) {
  const auth = await checkAuth(liffAccessToken);
  if (auth.isError) {
    return { items: [], error: auth.error, requiresSubscription: auth.requiresSubscription };
  }
  
  const supabase = new SupabaseService();
  const itemsResult = await supabase.getAllSavedMessages(auth.userId);

  if (!itemsResult.success) {
    return {
      items: [],
      error: itemsResult.error.userMessage,
    };
  }

  return { items: itemsResult.data, error: null };
}

// === Server Action aliases (for client-side import) ===
export const startChatSA = startChat;
export const continueChatSA = continueChat;
export const getChatSessionsSA = getChatSessions;
export const getSessionMessagesSA = getSessionMessages;
export const deleteChatSessionSA = deleteChatSession;
export const updateChatSessionTitleSA = updateChatSessionTitle;
export const saveMessageSA = saveMessage;
export const unsaveMessageSA = unsaveMessage;
export const getSavedMessageIdsSA = getSavedMessageIds;
export const getAllSavedMessagesSA = getAllSavedMessages;
