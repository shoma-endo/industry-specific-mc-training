import { v4 as uuidv4 } from 'uuid';
import { openAiService, ChatResponse } from './openAiService';
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
import { MODEL_CONFIGS } from '@/lib/constants';

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
    userMessage: string | string[],
    model?: string,
    semrushSearchUserMessage?: string,
    semrushSearchResult?: string
  ): Promise<{
    message: string;
    error?: string;
    sessionId?: string;
    requiresSubscription?: boolean;
  }> {
    try {
      let aiResponse: ChatResponse;
      let userMessageString: string;
      if (typeof userMessage === 'string') {
        userMessageString = userMessage;
        const config = model ? MODEL_CONFIGS[model] : null;
        const actualModel = config ? config.actualModel : model || 'gpt-4.1-nano-2025-04-14';
        const temperature = config ? config.temperature : 0.5;
        const maxTokens = config ? config.maxTokens : 1000;

        aiResponse = await openAiService.startChat(
          systemPrompt,
          userMessage,
          actualModel,
          temperature,
          maxTokens
        );

        if (aiResponse.error) {
          return aiResponse;
        }
      } else {
        userMessageString = userMessage[0]!;
        aiResponse = { message: userMessage[1]!, error: '' };
      }

      const sessionId = uuidv4();
      const now = Date.now();

      const session: DbChatSession = {
        id: sessionId,
        user_id: userId,
        title: userMessageString.substring(0, 50) + (userMessageString.length > 50 ? '...' : ''),
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
        content: semrushSearchUserMessage ?? userMessageString,
        created_at: now,
      };

      await this.supabaseService.createChatMessage(userDbMessage);

      const assistantDbMessage: DbChatMessage = {
        id: uuidv4(),
        user_id: userId,
        session_id: sessionId,
        role: ChatRole.ASSISTANT,
        content: semrushSearchResult
          ? aiResponse.message + '\n\n' + `【競合リサーチ結果】\n${semrushSearchResult}`
          : aiResponse.message,
        model: model,
        created_at: now + 1, // 順序を保証するため
      };

      await this.supabaseService.createChatMessage(assistantDbMessage);

      return {
        ...(semrushSearchResult
          ? {
              message: aiResponse.message + '\n\n' + `【競合リサーチ結果】\n${semrushSearchResult}`,
            }
          : aiResponse),
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
    userMessage: string | string[],
    systemPrompt: string,
    messages: OpenAIMessage[],
    model?: string,
    semrushSearchUserMessage?: string,
    semrushSearchResult?: string
  ): Promise<{
    message: string;
    error?: string;
    sessionId?: string;
    requiresSubscription?: boolean;
  }> {
    try {
      let aiResponse: ChatResponse;
      let userMessageString: string;
      if (typeof userMessage === 'string') {
        userMessageString = userMessage;
        const config = model ? MODEL_CONFIGS[model] : null;
        const actualModel = config ? config.actualModel : model || 'gpt-4.1-nano-2025-04-14';
        const temperature = config ? config.temperature : 0.5;
        const maxTokens = config ? config.maxTokens : 1000;

        aiResponse = await openAiService.continueChat(
          messages,
          userMessage,
          systemPrompt,
          actualModel,
          temperature,
          maxTokens
        );

        if (aiResponse.error) {
          return aiResponse;
        }
      } else {
        userMessageString = userMessage[0]!;
        aiResponse = { message: userMessage[1]!, error: '' };
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
        content: semrushSearchUserMessage ?? userMessageString,
        created_at: now,
      };

      await this.supabaseService.createChatMessage(userDbMessage);

      const assistantDbMessage: DbChatMessage = {
        id: uuidv4(),
        user_id: userId,
        session_id: sessionId,
        role: ChatRole.ASSISTANT,
        content: semrushSearchResult
          ? aiResponse.message + '\n\n' + `【競合リサーチ結果】\n${semrushSearchResult}`
          : aiResponse.message,
        model: model,
        created_at: now + 1, // 順序を保証するため
      };

      await this.supabaseService.createChatMessage(assistantDbMessage);

      return {
        ...(semrushSearchResult
          ? {
              message: aiResponse.message + '\n\n' + `【競合リサーチ結果】\n${semrushSearchResult}`,
            }
          : aiResponse),
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

  /**
   * チャットセッションを削除
   */
  async deleteChatSession(sessionId: string, userId: string): Promise<void> {
    try {
      await this.supabaseService.deleteChatSession(sessionId, userId);
    } catch (error) {
      console.error('Failed to delete chat session:', error);
      throw new Error('チャットセッションの削除に失敗しました');
    }
  }
}

export const chatService = new ChatService();
