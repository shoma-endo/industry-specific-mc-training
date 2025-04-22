'use server';

import { z } from 'zod';
import { chatService } from '@/server/services/chatService';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SYSTEM_PROMPT, KEYWORD_CATEGORIZATION_PROMPT } from '@/lib/prompts';
import { googleSearchAction } from '@/server/handler/actions/googleSearch.actions';
import { ChatResponse } from '@/types/chat';
import { formatAdItems } from '@/lib/adExtractor';
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
  // 他のFTモデルがあればここに追加…
};

export async function startChat(data: z.infer<typeof startChatSchema>): Promise<ChatResponse> {
  const { liffAccessToken, userMessage, model } = startChatSchema.parse(data);

  if (model === 'google_search') {
    // 1) 検索実行
    const { items, error } = await googleSearchAction({ liffAccessToken, query: userMessage })
    if (error) {
      return { message: '', error, requiresSubscription: false }
    }
    // 2) items を整形して１つの文字列にまとめる
    const message = formatAdItems(items)
    // 3) ChatResponse 形式で返す
    return { message, sessionId: undefined, requiresSubscription: false }
  }

  const authResult = await authMiddleware(liffAccessToken);
  if (authResult.error || authResult.requiresSubscription) {
    return {
      message: '',
      error: authResult.error,
      requiresSubscription: authResult.requiresSubscription,
    };
  }

  // モデルに応じたシステムプロンプトを選択
  const systemPrompt = SYSTEM_PROMPTS[model] ?? SYSTEM_PROMPT;

  return chatService.startChat(authResult.userId!, systemPrompt, userMessage, model);
}

export async function continueChat(
  data: z.infer<typeof continueChatSchema>
): Promise<ChatResponse> {
  const { liffAccessToken, sessionId, messages, userMessage, model } =
    continueChatSchema.parse(data);

    if (model === 'google_search') {
    // 1) 検索実行
    const { items, error } = await googleSearchAction({ liffAccessToken, query: userMessage })
    if (error) {
      return { message: '', error, requiresSubscription: false }
    }
    // 2) items を整形して１つの文字列にまとめる
    const message = formatAdItems(items)
    // 3) ChatResponse 形式で返す
    return { message, sessionId: undefined, requiresSubscription: false }
  }

  const authResult = await authMiddleware(liffAccessToken);
  if (authResult.error || authResult.requiresSubscription) {
    return {
      message: '',
      error: authResult.error,
      requiresSubscription: authResult.requiresSubscription,
    };
  }

  const systemPrompt = SYSTEM_PROMPTS[model] ?? SYSTEM_PROMPT;

  return chatService.continueChat(
    authResult.userId!,
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
  const authResult = await authMiddleware(liffAccessToken);
  if (authResult.error || authResult.requiresSubscription) {
    return {
      sessions: [],
      error: authResult.error,
      requiresSubscription: authResult.requiresSubscription,
    };
  }

  const sessions = await chatService.getUserSessions(authResult.userId!);
  return { sessions, error: null };
}

export async function getSessionMessages(sessionId: string, liffAccessToken: string) {
  const authResult = await authMiddleware(liffAccessToken);
  if (authResult.error || authResult.requiresSubscription) {
    return {
      messages: [],
      error: authResult.error,
      requiresSubscription: authResult.requiresSubscription,
    };
  }

  const messages = await chatService.getSessionMessages(sessionId, authResult.userId!);
  return { messages, error: null };
}
