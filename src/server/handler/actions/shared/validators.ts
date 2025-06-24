import { z } from 'zod';

export const startChatSchema = z.object({
  userMessage: z.string(),
  model: z.string(),
  liffAccessToken: z.string(),
});

export const continueChatSchema = z.object({
  sessionId: z.string(),
  messages: z.array(z.object({ role: z.string(), content: z.string() })),
  userMessage: z.string(),
  model: z.string(),
  liffAccessToken: z.string(),
});

export type StartChatInput = z.infer<typeof startChatSchema>;
export type ContinueChatInput = z.infer<typeof continueChatSchema>;