'use server';

import { authMiddleware } from '@/server/middleware/auth.middleware';
import { chatService } from '@/server/services/chatService';
import { ChatResponse } from '@/types/chat';
import { ModelHandlerService } from './chat/modelHandlers';
import { isOwner, isUnavailable } from '@/authUtils';
import { cookies } from 'next/headers';
import { userService } from '@/server/services/userService';
import type { UserRole } from '@/types/user';
import { z } from 'zod';
import { SupabaseService } from '@/server/services/supabaseService';
import { parseTimestampOrNull } from '@/lib/timestamps';
import {
  continueChatSchema,
  startChatSchema,
  type ContinueChatInput,
  type StartChatInput,
} from '@/server/schemas/chat.schema';

/**
 * オーナーの閲覧モードが有効かどうかを判定
 * @returns 閲覧モードが有効な場合は true
 */
async function isOwnerViewMode(): Promise<boolean> {
  return (await cookies()).get('owner_view_mode')?.value === '1';
}

const updateChatSessionTitleSchema = z.object({
  sessionId: z.string(),
  title: z.string().min(1).max(60),
  liffAccessToken: z.string(),
});

const searchChatSessionsSchema = z.object({
  query: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
  liffAccessToken: z.string(),
});

const modelHandler = new ModelHandlerService();

// 認証チェックを共通化（ロールも返す）
async function checkAuth(
  liffAccessToken: string,
  options?: { allowOwner?: boolean }
): Promise<
  | { isError: true; error: string | undefined; requiresSubscription?: boolean }
  | { isError: false; userId: string; role: UserRole; viewMode?: boolean }
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
    const user = authResult.userDetails ?? (await userService.getUserFromLiffToken(liffAccessToken));
    if (user && isUnavailable(user.role)) {
      return {
        isError: true as const,
        error: 'サービスの利用が停止されています',
        requiresSubscription: false,
      };
    }
    if (user && isOwner(user.role)) {
      if (options?.allowOwner) {
        if (!authResult.userId) {
          return {
            isError: true as const,
            error: '認証に失敗しました',
            requiresSubscription: false,
          };
        }
        return {
          isError: false as const,
          userId: authResult.userId,
          role: user.role,
          ...(authResult.viewMode ? { viewMode: true } : {}),
        };
      }
      return {
        isError: true as const,
        error: '閲覧権限では利用できません',
        requiresSubscription: false,
      };
    }
    if (!authResult.userId) {
      return {
        isError: true as const,
        error: '認証に失敗しました',
        requiresSubscription: false,
      };
    }
    return {
      isError: false as const,
      userId: authResult.userId,
      role: user?.role ?? 'trial',
      ...(authResult.viewMode ? { viewMode: true } : {}),
    };
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
  const isViewMode = await isOwnerViewMode();
  const auth = await checkAuth(liffAccessToken, { allowOwner: isViewMode });
  if (auth.isError) {
    return { sessions: [], error: auth.error, requiresSubscription: auth.requiresSubscription };
  }
  const sessions = await chatService.getUserSessions(auth.userId);
  return { sessions, error: null };
}

export async function getSessionMessages(sessionId: string, liffAccessToken: string) {
  const isViewMode = await isOwnerViewMode();
  const auth = await checkAuth(liffAccessToken, { allowOwner: isViewMode });
  if (auth.isError) {
    return { messages: [], error: auth.error, requiresSubscription: auth.requiresSubscription };
  }
  const messages = await chatService.getSessionMessages(sessionId, auth.userId);
  return { messages, error: null };
}

export async function getLatestBlogStep7MessageBySession(
  sessionId: string,
  liffAccessToken: string
): Promise<
  | { success: false; error: string }
  | { success: true; data: { content: string; createdAt: number } | null }
> {
  if (!sessionId) {
    return { success: false as const, error: 'セッションIDが必要です' };
  }

  const isViewMode = await isOwnerViewMode();
  const auth = await checkAuth(liffAccessToken, { allowOwner: isViewMode });
  if (auth.isError) {
    return { success: false as const, error: auth.error ?? '認証に失敗しました' };
  }

  const supabase = new SupabaseService();
  const result = await supabase.getLatestChatMessageBySessionAndModel(
    sessionId,
    auth.userId,
    'blog_creation_step7'
  );

  if (!result.success) {
    return { success: false as const, error: result.error.userMessage };
  }

  if (!result.data) {
    return { success: true as const, data: null };
  }

  const createdAt = parseTimestampOrNull(result.data.created_at);
  if (createdAt === null) {
    console.error('[getLatestBlogStep7MessageBySession] Invalid created_at', {
      sessionId,
      createdAt: result.data.created_at,
    });
    return { success: false as const, error: 'タイムスタンプの解析に失敗しました' };
  }

  return {
    success: true as const,
    data: {
      content: result.data.content,
      createdAt,
    },
  };
}

export async function searchChatSessions(data: z.infer<typeof searchChatSessionsSchema>) {
  const parsed = searchChatSessionsSchema.parse(data);

  const isViewMode = await isOwnerViewMode();
  const auth = await checkAuth(parsed.liffAccessToken, { allowOwner: isViewMode });
  if (auth.isError) {
    return {
      results: [],
      error: auth.error,
      requiresSubscription: auth.requiresSubscription,
    };
  }

  try {
    const options = parsed.limit !== undefined ? { limit: parsed.limit } : undefined;
    const matches = await chatService.searchChatSessions(auth.userId, parsed.query ?? '', options);

    return {
      results: matches.map(match => ({
        sessionId: match.sessionId,
        title: match.title,
        canonicalUrl: match.canonicalUrl,
        wordpressTitle: match.wordpressTitle,
        lastMessageAt: match.lastMessageAt,
        similarityScore: match.similarityScore,
      })),
      error: null,
      requiresSubscription: false,
    };
  } catch (error) {
    console.error('Failed to search chat sessions:', error);
    return {
      results: [],
      error: error instanceof Error ? error.message : 'チャットセッションの検索に失敗しました',
      requiresSubscription: false,
    };
  }
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

// === Server Action aliases (for client-side import) ===
export const startChatSA = startChat;
export const continueChatSA = continueChat;
export const getChatSessionsSA = getChatSessions;
export const getSessionMessagesSA = getSessionMessages;
export const deleteChatSessionSA = deleteChatSession;
export const updateChatSessionTitleSA = updateChatSessionTitle;
export const searchChatSessionsSA = searchChatSessions;
