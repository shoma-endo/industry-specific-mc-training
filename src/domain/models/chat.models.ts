import { ChatMessage, ChatSession } from '../interfaces/IChatService';

export interface ChatState {
  readonly messages: ChatMessage[];
  readonly sessions: ChatSession[];
  readonly currentSessionId: string;
  readonly isLoading: boolean;
  readonly error: string | null;
}

export const initialChatState: ChatState = {
  messages: [],
  sessions: [],
  currentSessionId: '',
  isLoading: false,
  error: null,
};

export const createUserMessage = (content: string): ChatMessage => ({
  id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  role: 'user',
  content,
  timestamp: new Date(),
});

export const createAssistantMessage = (content: string, model?: string | undefined): ChatMessage => ({
  id: `assistant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  role: 'assistant',
  content,
  timestamp: new Date(),
  model: model || undefined,
});