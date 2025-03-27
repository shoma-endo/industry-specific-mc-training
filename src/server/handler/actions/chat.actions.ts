'use server';

import { z } from 'zod';
import { chatService } from '@/server/services/chatService';
import { cookies } from 'next/headers';

const USER_ID_COOKIE = 'line_user_id';

const startChatSchema = z.object({
  systemPrompt: z.string(),
  userMessage: z.string(),
  model: z.string().optional(),
});

const continueChatSchema = z.object({
  sessionId: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
    })
  ),
  userMessage: z.string(),
  model: z.string().optional(),
});

export async function startChat(data: z.infer<typeof startChatSchema>) {
  const validatedData = startChatSchema.parse(data);
  const userId = (await cookies()).get(USER_ID_COOKIE)?.value;
  
  if (!userId) {
    return { message: '', error: 'ユーザーIDが見つかりません。再ログインしてください。' };
  }
  
  return chatService.startChat(
    userId,
    validatedData.systemPrompt,
    validatedData.userMessage,
    validatedData.model
  );
}

export async function continueChat(data: z.infer<typeof continueChatSchema>) {
  const validatedData = continueChatSchema.parse(data);
  const userId = (await cookies()).get(USER_ID_COOKIE)?.value;
  
  if (!userId) {
    return { message: '', error: 'ユーザーIDが見つかりません。再ログインしてください。' };
  }
  
  return chatService.continueChat(
    userId,
    validatedData.sessionId,
    validatedData.userMessage,
    validatedData.messages,
    validatedData.model
  );
}

export async function getChatSessions() {
  const userId = (await cookies()).get(USER_ID_COOKIE)?.value;
  
  if (!userId) {
    return { sessions: [], error: 'ユーザーIDが見つかりません。再ログインしてください。' };
  }
  
  try {
    const sessions = await chatService.getUserSessions(userId);
    return { sessions, error: null };
  } catch (error) {
    console.error('Failed to get chat sessions:', error);
    return { sessions: [], error: 'チャットセッションの取得に失敗しました' };
  }
}

export async function getSessionMessages(sessionId: string) {
  const userId = (await cookies()).get(USER_ID_COOKIE)?.value;
  
  if (!userId) {
    return { messages: [], error: 'ユーザーIDが見つかりません。再ログインしてください。' };
  }
  
  try {
    const messages = await chatService.getSessionMessages(sessionId);
    return { messages, error: null };
  } catch (error) {
    console.error('Failed to get session messages:', error);
    return { messages: [], error: 'チャットメッセージの取得に失敗しました' };
  }
}
