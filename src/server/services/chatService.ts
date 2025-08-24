import { v4 as uuidv4 } from 'uuid';
import { llmChat } from './llmService';
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
import { ChatError, ChatErrorCode } from '@/domain/errors/ChatError';

interface ChatResponse {
  message: string;
  error?: string;
  requiresSubscription?: boolean;
}

class ChatService {
  private supabaseService: SupabaseService;
  // 必要最低限のトークン管理: 直近の履歴のみ保持（約6往復）
  private static readonly MAX_HISTORY_MESSAGES: number = 12;

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
      // 制限チェックは呼び出し元（サーバーアクション）でロールに応じて実施
      let aiResponse: ChatResponse;
      let userMessageString: string;
      if (typeof userMessage === 'string') {
        userMessageString = userMessage;
        const config =
          MODEL_CONFIGS[model ?? 'ad_copy_finishing'] ?? MODEL_CONFIGS['ad_copy_finishing']!;
        const providerKey = config.provider;
        const llmModel = config.actualModel;

        try {
          const aiReply = await llmChat(
            providerKey,
            llmModel,
            [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
            { temperature: config.temperature, maxTokens: config.maxTokens }
          );

          aiResponse = { message: aiReply };
        } catch (error) {
          console.error('LLM Chat error:', error);
          // 既にChatErrorであればそのまま投げ直し（文言を上書きしない）
          if (error instanceof ChatError) {
            throw error;
          }
          // 未分類のエラーは汎用化
          throw ChatError.fromApiError(error, { model: llmModel });
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
      if (error instanceof ChatError) {
        console.error('Chat domain error:', error);
        return { message: '', error: error.userMessage };
      }
      console.error('Failed to start chat:', error);
      throw new ChatError('チャットの開始に失敗しました', ChatErrorCode.SESSION_CREATION_FAILED, {
        userId,
        error,
      });
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
      // 制限チェックは呼び出し元（サーバーアクション）でロールに応じて実施
      // ✅ デバッグログ: 履歴の確認
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `[ChatService] continueChat - Model: ${model}, History length: ${messages.length}`
        );
        if (messages.length > 0) {
          console.log(
            `[ChatService] History preview:`,
            messages.slice(-3).map(m => ({
              role: m.role,
              content: m.content.substring(0, 50) + (m.content.length > 50 ? '...' : ''),
            }))
          );
        }
      }

      let aiResponse: ChatResponse;
      let userMessageString: string;
      if (typeof userMessage === 'string') {
        userMessageString = userMessage;
        const config =
          MODEL_CONFIGS[model ?? 'ad_copy_finishing'] ?? MODEL_CONFIGS['ad_copy_finishing']!;
        const providerKey = config.provider;
        const llmModel = config.actualModel;

        try {
          // Kターン制限 + 古い履歴の簡易要約
          let recentMessages = messages;
          let finalSystemPrompt = systemPrompt;

          if (messages.length > ChatService.MAX_HISTORY_MESSAGES) {
            const numToTrim = messages.length - ChatService.MAX_HISTORY_MESSAGES;
            const olderMessages = messages.slice(0, numToTrim);
            recentMessages = messages.slice(-ChatService.MAX_HISTORY_MESSAGES);

            try {
              const summary = await this.summarizeHistory(olderMessages);
              if (summary && summary.trim().length > 0) {
                finalSystemPrompt = `${systemPrompt}\n\n【直前までの会話要約】\n${summary}`;
              }
            } catch {
              // 要約に失敗しても直近K件のみで続行
            }
          }

          const llmMessages = [
            { role: 'system' as const, content: finalSystemPrompt },
            ...recentMessages.map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
            { role: 'user' as const, content: userMessage },
          ];

          // ✅ デバッグログ: LLMに送信するメッセージの確認
          if (process.env.NODE_ENV === 'development') {
            console.log(`[ChatService] LLM messages length: ${llmMessages.length}`);
            console.log(`[ChatService] LLM provider: ${providerKey}, model: ${llmModel}`);
          }

          const aiReply = await llmChat(providerKey, llmModel, llmMessages, {
            temperature: config.temperature,
            maxTokens: config.maxTokens,
          });

          aiResponse = { message: aiReply };
        } catch (error) {
          console.error('LLM Chat error:', error);
          if (error instanceof ChatError) {
            throw error;
          }
          throw ChatError.fromApiError(error, { model: llmModel, sessionId });
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
      if (error instanceof ChatError) {
        console.error('Chat domain error:', error);
        return { message: '', error: error.userMessage };
      }
      console.error('Failed to continue chat:', error);
      throw new ChatError('チャットの継続に失敗しました', ChatErrorCode.MESSAGE_SEND_FAILED, {
        userId,
        sessionId,
        error,
      });
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
      throw new ChatError(
        'チャットセッションの取得に失敗しました',
        ChatErrorCode.SESSION_LOAD_FAILED,
        { userId, error }
      );
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
      throw new ChatError('メッセージの取得に失敗しました', ChatErrorCode.MESSAGE_LOAD_FAILED, {
        sessionId,
        userId,
        error,
      });
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
      throw new ChatError(
        'チャットセッションの削除に失敗しました',
        ChatErrorCode.SESSION_DELETE_FAILED,
        { sessionId, userId, error }
      );
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
      const { data, error } = await this.supabaseService
        .getClient()
        .rpc('get_sessions_with_messages', { p_user_id: userId });

      if (error) {
        console.error('Failed to get sessions with messages (RPC):', error);
        // RPCが失敗した場合は旧実装にフォールバック
        console.warn('Falling back to legacy implementation');
        try {
          return this.getSessionsWithMessagesLegacy(userId);
        } catch (fallbackError) {
          throw new ChatError(
            'セッション取得に失敗しました（RPC/レガシー両方）',
            ChatErrorCode.SESSION_LOAD_FAILED,
            { userId, rpcError: error, fallbackError }
          );
        }
      }

      return (data ?? []).map(
        (row: {
          session_id: string;
          title: string;
          last_message_at: number;
          messages: ServerChatMessage[];
        }) => ({
          id: row.session_id,
          title: row.title,
          last_message_at: row.last_message_at,
          messages: row.messages || [],
        })
      );
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
        sessions.slice(0, 5).map(async session => {
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
      throw new ChatError('セッション取得に失敗しました', ChatErrorCode.SESSION_LOAD_FAILED, {
        userId,
        error,
      });
    }
  }

  /**
   * 古い履歴を簡易要約（日本語・箇条書き・約300文字）
   */
  private async summarizeHistory(messages: OpenAIMessage[]): Promise<string> {
    const target = messages.slice(-8);
    const serialized = target
      .map(
        m =>
          `${m.role === 'user' ? 'ユーザー' : m.role === 'assistant' ? 'アシスタント' : 'システム'}: ${m.content}`
      )
      .join('\n');

    const system =
      'あなたは会話要約のアシスタントです。過去の会話を日本語で最重要ポイントのみ、箇条書きで3〜6項目、合計300文字程度で要約してください。前置きや蛇足は不要です。';

    const summarizerModel =
      MODEL_CONFIGS['ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2']?.actualModel || 'gpt-4o-mini';

    const text = await llmChat(
      'openai',
      summarizerModel,
      [
        { role: 'system', content: system },
        { role: 'user', content: serialized.slice(0, 4000) },
      ],
      { temperature: 0.2, maxTokens: 600 }
    );

    return text;
  }
}

export const chatService = new ChatService();
