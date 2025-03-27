import { v4 as uuidv4 } from 'uuid';
import { SupabaseService } from './supabaseService';
import {
  ChatMessage,
  ChatSession,
  DbChatSession,
  toChatMessage,
  toChatSession,
  toDbChatMessage,
  toDbChatSession,
} from '@/types/chat';

/**
 * チャットリポジトリ: チャットデータのCRUD操作を提供
 */
export class ChatRepository {
  private supabaseService: SupabaseService;

  constructor() {
    this.supabaseService = new SupabaseService();
  }

  async createSession(
    userId: string,
    title: string,
    systemPrompt?: string
  ): Promise<ChatSession> {
    const now = Date.now();
    const sessionId = uuidv4();

    const session: ChatSession = {
      id: sessionId,
      userId,
      title,
      systemPrompt,
      lastMessageAt: now,
      createdAt: now,
    };

    await this.supabaseService.createChatSession(toDbChatSession(session));
    return session;
  }

  async getSessionById(sessionId: string): Promise<ChatSession | null> {
    const dbSession = await this.supabaseService.getChatSessionById(sessionId);
    return dbSession ? toChatSession(dbSession) : null;
  }

  async getUserSessions(userId: string): Promise<ChatSession[]> {
    const dbSessions = await this.supabaseService.getUserChatSessions(userId);
    return dbSessions.map(toChatSession);
  }

  async updateSession(
    sessionId: string,
    updates: Partial<Omit<ChatSession, 'id' | 'userId' | 'createdAt'>>
  ): Promise<void> {
    const dbUpdates: Partial<DbChatSession> = {};

    if (updates.title) dbUpdates.title = updates.title;
    if (updates.systemPrompt !== undefined) dbUpdates.system_prompt = updates.systemPrompt;
    if (updates.lastMessageAt) dbUpdates.last_message_at = updates.lastMessageAt;

    await this.supabaseService.updateChatSession(sessionId, dbUpdates);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.supabaseService.deleteChatSession(sessionId);
  }

  async createMessage(message: Omit<ChatMessage, 'id'>): Promise<ChatMessage> {
    const messageId = uuidv4();
    const fullMessage: ChatMessage = {
      ...message,
      id: messageId,
    };

    await this.supabaseService.createChatMessage(toDbChatMessage(fullMessage));

    await this.updateSession(message.sessionId, {
      lastMessageAt: message.createdAt,
    });

    return fullMessage;
  }

  async getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
    const dbMessages = await this.supabaseService.getChatMessagesBySessionId(sessionId);
    return dbMessages.map(toChatMessage);
  }
}

export const chatRepository = new ChatRepository();
