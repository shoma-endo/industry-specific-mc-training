'use server';

import { z } from 'zod';
import { chatService } from '@/server/services/chatService';
import { authMiddleware } from '@/server/middleware/auth.middleware';

type ChatResponse = {
  message: string;
  error?: string | undefined;
  sessionId?: string | undefined;
  requiresSubscription?: boolean | undefined;
};

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

export async function startChat(data: z.infer<typeof startChatSchema>): Promise<ChatResponse> {
  const validatedData = startChatSchema.parse(data);

  const authResult = await authMiddleware(validatedData.liffAccessToken);
  if (authResult.error || authResult.requiresSubscription) {
    return {
      message: '',
      error: authResult.error,
      requiresSubscription: authResult.requiresSubscription,
    };
  }

  return chatService.startChat(
    authResult.userId!,
    validatedData.systemPrompt,
    validatedData.userMessage,
    validatedData.model
  );
}

export async function continueChat(
  data: z.infer<typeof continueChatSchema>
): Promise<ChatResponse> {
  const validatedData = continueChatSchema.parse(data);

  const authResult = await authMiddleware(validatedData.liffAccessToken);
  if (authResult.error || authResult.requiresSubscription) {
    return {
      message: '',
      error: authResult.error,
      requiresSubscription: authResult.requiresSubscription,
    };
  }

  return chatService.continueChat(
    authResult.userId!,
    validatedData.sessionId,
    validatedData.userMessage,
    validatedData.messages,
    validatedData.model
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
