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
  ServerChatSession,
  ServerChatMessage,
} from '@/types/chat';
import { SupabaseService } from './supabaseService';
import { MODEL_CONFIGS, FEATURE_FLAGS } from '@/lib/constants';

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
        const actualModel = config ? config.actualModel : model || 'gpt-4.1-nano';
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
        const actualModel = config ? config.actualModel : model || 'gpt-4.1-nano';
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

  /**
   * Server Component用: セッションとメッセージを一括取得 (RPC)
   * N+1問題を解消し、パフォーマンスを向上
   * Feature Flagによって新旧実装を切り替え可能
   */
  async getSessionsWithMessages(userId: string): Promise<ServerChatSession[]> {
    if (FEATURE_FLAGS.USE_RPC_V2) {
      // 新実装: RPC関数を使用
      const { data, error } = await this.supabaseService.getClient()
        .rpc('get_sessions_with_messages', { p_user_id: userId });

      if (error) {
        console.error('Failed to get sessions with messages (RPC):', error);
        // RPCが失敗した場合は旧実装にフォールバック
        console.warn('Falling back to legacy implementation');
        return this.getSessionsWithMessagesLegacy(userId);
      }

      return (data ?? []).map((row: {
        session_id: string;
        title: string;
        last_message_at: number;
        messages: ServerChatMessage[];
      }) => ({
        id: row.session_id,
        title: row.title,
        last_message_at: row.last_message_at,
        messages: row.messages || [],
      }));
    } else {
      // 旧実装: 従来の方法
      return this.getSessionsWithMessagesLegacy(userId);
    }
  }

  /**
   * レガシー実装: 個別にセッションとメッセージを取得（フォールバック用）
   */
  private async getSessionsWithMessagesLegacy(userId: string): Promise<ServerChatSession[]> {
    try {
      const sessions = await this.getUserSessions(userId);
      
      // 最大5件のセッションのみメッセージを取得（パフォーマンス考慮）
      const sessionsWithMessages = await Promise.all(
        sessions.slice(0, 5).map(async (session) => {
          const messages = await this.getSessionMessages(session.id, userId);
          const serverMessages: ServerChatMessage[] = messages.map(msg => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
            created_at: msg.createdAt,
          }));

          return {
            id: session.id,
            title: session.title,
            last_message_at: session.lastMessageAt,
            messages: serverMessages,
          };
        })
      );

      return sessionsWithMessages;
    } catch (error) {
      console.error('Failed to get sessions with messages (legacy):', error);
      throw new Error('セッション取得に失敗しました');
    }
  }
}

export const chatService = new ChatService();
