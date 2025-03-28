'use server';

import { z } from 'zod';
import { chatService } from '@/server/services/chatService';
import { LineAuthService } from '@/server/services/lineAuthService';

const lineAuthService = new LineAuthService();

const startChatSchema = z.object({
  systemPrompt: z.string(),
  userMessage: z.string(),
  model: z.string().optional(),
  liffAccessToken: z.string(),
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
  liffAccessToken: z.string(),
});

export async function startChat(data: z.infer<typeof startChatSchema>) {
  const validatedData = startChatSchema.parse(data);
  
  try {
    const lineProfile = await lineAuthService.getLineProfile(validatedData.liffAccessToken);
    const userId = lineProfile.userId;
    
    return chatService.startChat(
      userId,
      validatedData.systemPrompt,
      validatedData.userMessage,
      validatedData.model
    );
  } catch (error) {
    console.error('Failed to start chat:', error);
    return { message: '', error: 'ユーザー認証に失敗しました。再ログインしてください。' };
  }
}

export async function continueChat(data: z.infer<typeof continueChatSchema>) {
  const validatedData = continueChatSchema.parse(data);
  
  try {
    const lineProfile = await lineAuthService.getLineProfile(validatedData.liffAccessToken);
    const userId = lineProfile.userId;
    
    return chatService.continueChat(
      userId,
      validatedData.sessionId,
      validatedData.userMessage,
      validatedData.messages,
      validatedData.model
    );
  } catch (error) {
    console.error('Failed to continue chat:', error);
    return { message: '', error: 'ユーザー認証に失敗しました。再ログインしてください。' };
  }
}

export async function getChatSessions(liffAccessToken: string) {
  try {
    const lineProfile = await lineAuthService.getLineProfile(liffAccessToken);
    const userId = lineProfile.userId;
    
    const sessions = await chatService.getUserSessions(userId);
    return { sessions, error: null };
  } catch (error) {
    console.error('Failed to get chat sessions:', error);
    return { sessions: [], error: 'チャットセッションの取得に失敗しました' };
  }
}

export async function getSessionMessages(sessionId: string, liffAccessToken: string) {
  try {
    const lineProfile = await lineAuthService.getLineProfile(liffAccessToken);
    const userId = lineProfile.userId;
    
    const messages = await chatService.getSessionMessages(sessionId);
    return { messages, error: null };
  } catch (error) {
    console.error('Failed to get session messages:', error);
    return { messages: [], error: 'チャットメッセージの取得に失敗しました' };
  }
}
