import { v4 as uuidv4 } from 'uuid';
import { openAiService } from './openAiService';
import {
  ChatMessage,
  ChatSession,
  DbChatMessage,
  DbChatSession,
  ChatRole,
  toChatMessage,
  toChatSession,
  OpenAIMessage,
} from '@/types/chat';
import { SupabaseService } from './supabaseService';

class ChatService {
  private supabaseService: SupabaseService;

  constructor() {
    this.supabaseService = new SupabaseService();
  }

  /**
   * 新しいチャットを開始する
   */
  async startChat(
    userId: string,
    systemPrompt: string,
    userMessage: string,
    model?: string
  ): Promise<{
    message: string;
    error?: string;
    sessionId?: string;
    requiresSubscription?: boolean;
  }> {
    try {
      const aiResponse = await openAiService.startChat(systemPrompt, userMessage, model);

      if (aiResponse.error) {
        return aiResponse;
      }

      const sessionId = uuidv4();
      const now = Date.now();

      const session: DbChatSession = {
        id: sessionId,
        user_id: userId,
        title: userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : ''),
        created_at: now,
        last_message_at: now,
        system_prompt: systemPrompt,
      };

      await this.supabaseService.createChatSession(session);

      const userDbMessage: DbChatMessage = {
        id: uuidv4(),
        user_id: userId,
        session_id: sessionId,
        role: ChatRole.USER,
        content: userMessage,
        created_at: now,
      };

      await this.supabaseService.createChatMessage(userDbMessage);

      const assistantDbMessage: DbChatMessage = {
        id: uuidv4(),
        user_id: userId,
        session_id: sessionId,
        role: ChatRole.ASSISTANT,
        content: aiResponse.message,
        model: model,
        created_at: now + 1, // 順序を保証するため
      };

      await this.supabaseService.createChatMessage(assistantDbMessage);

      return {
        ...aiResponse,
        sessionId,
      };
    } catch (error) {
      console.error('Failed to start chat:', error);
      return { message: '', error: 'チャットの開始に失敗しました' };
    }
  }

  /**
   * 既存のチャットを継続する
   */
  async continueChat(
    userId: string,
    sessionId: string,
    userMessage: string,
    systemPrompt: string,
    messages: OpenAIMessage[],
    model?: string
  ): Promise<{
    message: string;
    error?: string;
    sessionId?: string;
    requiresSubscription?: boolean;
  }> {
    try {
      const aiResponse = await openAiService.continueChat(
        messages,
        userMessage,
        systemPrompt,
        model
      );

      if (aiResponse.error) {
        return aiResponse;
      }

      const now = Date.now();

      await this.supabaseService.updateChatSession(sessionId, userId, {
        last_message_at: now,
      });

      const userDbMessage: DbChatMessage = {
        id: uuidv4(),
        user_id: userId,
        session_id: sessionId,
        role: ChatRole.USER,
        content: userMessage,
        created_at: now,
      };

      await this.supabaseService.createChatMessage(userDbMessage);

      const assistantDbMessage: DbChatMessage = {
        id: uuidv4(),
        user_id: userId,
        session_id: sessionId,
        role: ChatRole.ASSISTANT,
        content: aiResponse.message,
        model: model,
        created_at: now + 1, // 順序を保証するため
      };

      await this.supabaseService.createChatMessage(assistantDbMessage);

      return {
        ...aiResponse,
        sessionId,
      };
    } catch (error) {
      console.error('Failed to continue chat:', error);
      return { message: '', error: 'チャットの継続に失敗しました' };
    }
  }

  /**
   * ユーザーのチャットセッション一覧を取得
   */
  async getUserSessions(userId: string): Promise<ChatSession[]> {
    try {
      const dbSessions = await this.supabaseService.getUserChatSessions(userId);
      return dbSessions.map(session => toChatSession(session));
    } catch (error) {
      console.error('Failed to get user sessions:', error);
      return [];
    }
  }

  /**
   * セッションのメッセージ一覧を取得
   */
  async getSessionMessages(sessionId: string, userId: string): Promise<ChatMessage[]> {
    try {
      const dbMessages = await this.supabaseService.getChatMessagesBySessionId(sessionId, userId);
      return dbMessages.map(message => toChatMessage(message));
    } catch (error) {
      console.error('Failed to get session messages:', error);
      return [];
    }
  }
}

export const chatService = new ChatService();
