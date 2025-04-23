'use server';

import { z } from 'zod';
import { chatService } from '@/server/services/chatService';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SYSTEM_PROMPT, KEYWORD_CATEGORIZATION_PROMPT } from '@/lib/prompts';
import { googleSearchAction } from '@/server/handler/actions/googleSearch.actions';
import { ChatResponse } from '@/types/chat';
import { formatAdItems } from '@/lib/adExtractor';
import { SupabaseService } from '@/server/services/supabaseService';
import { randomUUID } from 'crypto';

const supabaseService = new SupabaseService();

const startChatSchema = z.object({
  userMessage: z.string(),
  model: z.string(),
  liffAccessToken: z.string(),
});

const continueChatSchema = z.object({
  sessionId: z.string(),
  messages: z.array(z.object({ role: z.string(), content: z.string() })),
  userMessage: z.string(),
  model: z.string(),
  liffAccessToken: z.string(),
});

const SYSTEM_PROMPTS: Record<string, string> = {
  'ft:gpt-4o-mini-2024-07-18:personal::BLnZBIRz': KEYWORD_CATEGORIZATION_PROMPT,
  // TODO: AIモデルは追加時にここに追加
};

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
  return { isError: false as const, userId: authResult.userId! };
}

export async function startChat(data: z.infer<typeof startChatSchema>): Promise<ChatResponse> {
  const { liffAccessToken, userMessage, model } = startChatSchema.parse(data);

  // --- 共通: 認証 ---
  const auth = await checkAuth(liffAccessToken);
  if (auth.isError) {
    return { message: '', error: auth.error, requiresSubscription: auth.requiresSubscription };
  }
  const userId = auth.userId;

  // --- google_search 分岐 ---
  if (model === 'google_search') {
    // 1) 検索実行
    const { items, error } = await googleSearchAction({ liffAccessToken, query: userMessage });
    if (error) {
      return { message: '', error, requiresSubscription: false };
    }

    // 2) 新規セッションを作成
    const sessionId = await supabaseService.createChatSession({
      id: randomUUID(),
      user_id: userId,
      title: userMessage,
      system_prompt: undefined,
      last_message_at: Date.now(),
      created_at: Date.now(),
    });

    // 3) ユーザー入力をチャットメッセージとして保存
    await supabaseService.createChatMessage({
      id: randomUUID(),
      user_id: userId,
      session_id: sessionId,
      role: 'user',
      content: userMessage,
      model: 'google_search',
      created_at: Date.now(),
    });

    // 4) 検索結果をフォーマットしてチャットメッセージとして保存
    const reply = formatAdItems(items);
    await supabaseService.createChatMessage({
      id: randomUUID(),
      user_id: userId,
      session_id: sessionId,
      role: 'assistant',
      content: reply,
      model: 'google_search',
      created_at: Date.now(),
    });

    // 5) クライアントに返却
    return {
      message: reply,
      sessionId,
      requiresSubscription: false,
    };
  }

  // --- FTモデル／標準チャット分岐 ---
  const systemPrompt = SYSTEM_PROMPTS[model] ?? SYSTEM_PROMPT;
  return chatService.startChat(userId, systemPrompt, userMessage, model);
}

export async function continueChat(
  data: z.infer<typeof continueChatSchema>
): Promise<ChatResponse> {
  const { liffAccessToken, sessionId, messages, userMessage, model } =
    continueChatSchema.parse(data);

  // --- 共通: 認証 ---
  const auth = await checkAuth(liffAccessToken);
  if (auth.isError) {
    return { message: '', error: auth.error, requiresSubscription: auth.requiresSubscription };
  }
  const userId = auth.userId;

  // --- google_search 分岐 ---
  if (model === 'google_search') {
    const { items, error } = await googleSearchAction({ liffAccessToken, query: userMessage });
    if (error) {
      return { message: '', error, requiresSubscription: false };
    }

    // 1) ユーザー入力を保存
    await supabaseService.createChatMessage({
      id: randomUUID(),
      user_id: userId,
      session_id: sessionId,
      role: 'user',
      content: userMessage,
      model: 'google_search',
      created_at: Date.now(),
    });

    // 2) 検索結果を保存
    const reply = formatAdItems(items);
    await supabaseService.createChatMessage({
      id: randomUUID(),
      user_id: userId,
      session_id: sessionId,
      role: 'assistant',
      content: reply,
      model: 'google_search',
      created_at: Date.now(),
    });

    // 3) クライアントに返却
    return {
      message: reply,
      sessionId,
      requiresSubscription: false,
    };
  }

  // --- FTモデル／標準チャット分岐 ---
  const systemPrompt = SYSTEM_PROMPTS[model] ?? SYSTEM_PROMPT;
  return chatService.continueChat(
    userId,
    sessionId,
    userMessage,
    systemPrompt,
    messages.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
    })),
    model
  );
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
