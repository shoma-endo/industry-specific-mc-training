'use server';

import { z } from 'zod';
import { openAiService } from '@/server/services/openAiService';

const startChatSchema = z.object({
  systemPrompt: z.string(),
  userMessage: z.string(),
});

const continueChatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
    })
  ),
  userMessage: z.string(),
});

export async function startChat(data: z.infer<typeof startChatSchema>) {
  const validatedData = startChatSchema.parse(data);
  return openAiService.startChat(validatedData.systemPrompt, validatedData.userMessage);
}

export async function continueChat(data: z.infer<typeof continueChatSchema>) {
  const validatedData = continueChatSchema.parse(data);
  return openAiService.continueChat(validatedData.messages, validatedData.userMessage);
}
