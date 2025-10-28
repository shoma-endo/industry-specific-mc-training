export interface SendMessageParams {
  content: string;
  model: string;
  accessToken: string;
  sessionId?: string | undefined;
  isNewSession: boolean;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  systemPrompt?: string | undefined;
}

export interface SendMessageResponse {
  message: string;
  sessionId?: string | undefined;
  error?: string | undefined;
  requiresSubscription?: boolean | undefined;
}

export interface ChatMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly timestamp: Date;
  readonly model?: string | undefined;
}

export interface ChatSession {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: Date;
  readonly messageCount: number;
  readonly lastMessage?: string | undefined;
}

export interface IChatService {
  sendMessage(params: SendMessageParams): Promise<SendMessageResponse>;
  loadSessions(): Promise<ChatSession[]>;
  loadSessionMessages(sessionId: string): Promise<ChatMessage[]>;
  deleteSession(sessionId: string): Promise<void>;
  updateSessionTitle(sessionId: string, title: string): Promise<void>;
  startNewSession(): string;
}
