import {
  IChatService,
  SendMessageParams,
  SendMessageResponse,
  ChatSession,
  ChatMessage,
} from '../interfaces/IChatService';
import {
  startChatSA,
  continueChatSA,
  getChatSessionsSA,
  getSessionMessagesSA,
  deleteChatSessionSA,
} from '@/server/handler/actions/chat.actions';
import { ChatError, ChatErrorCode } from '../errors/ChatError';
import type { ChatMessage as ServerChatMessage } from '@/types/chat';

export class ChatService implements IChatService {
  private accessTokenProvider: (() => Promise<string>) | null = null;

  setAccessTokenProvider(provider: () => Promise<string>) {
    this.accessTokenProvider = provider;
  }

  async sendMessage(params: SendMessageParams): Promise<SendMessageResponse> {
    try {
      const response = params.isNewSession
        ? await this.startNewChat(params)
        : await this.continueChat(params);

      return response;
    } catch (error) {
      // 既に意味のある ChatError であれば、そのままのユーザー向け文言を保つため再送出
      if (error instanceof ChatError) {
        throw error;
      }
      const errorMessage = this.handleError(error);
      throw new ChatError(errorMessage, ChatErrorCode.MESSAGE_SEND_FAILED, { params, error });
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const accessToken = await this.getAccessToken();
      const result = await deleteChatSessionSA(sessionId, accessToken);
      if (!result.success) {
        throw new ChatError(
          result.error || 'セッションの削除に失敗しました',
          ChatErrorCode.SESSION_DELETE_FAILED,
          { sessionId }
        );
      }
    } catch (error) {
      if (error instanceof ChatError) {
        throw error;
      }
      throw new ChatError(
        'セッションの削除中にエラーが発生しました',
        ChatErrorCode.SESSION_DELETE_FAILED,
        { sessionId, error }
      );
    }
  }

  async loadSessions(): Promise<ChatSession[]> {
    try {
      const accessToken = await this.getAccessToken();
      const result = await getChatSessionsSA(accessToken);

      if (result.error) {
        throw new ChatError(result.error, ChatErrorCode.SESSION_LOAD_FAILED);
      }

      if (!result.sessions) {
        return [];
      }

      const formattedSessions: ChatSession[] = result.sessions.map(session => ({
        id: session.id,
        title: session.title,
        updatedAt: new Date(session.lastMessageAt || session.createdAt),
        messageCount: 0, // メッセージ数はAPI応答に含まれていない
        lastMessage: undefined as string | undefined, // 最後のメッセージはAPI応答に含まれていない
      }));

      return formattedSessions;
    } catch (error) {
      if (error instanceof ChatError) {
        throw error;
      }
      throw new ChatError(
        'チャットセッションの読み込み中にエラーが発生しました',
        ChatErrorCode.SESSION_LOAD_FAILED,
        { error }
      );
    }
  }

  async loadSessionMessages(sessionId: string): Promise<ChatMessage[]> {
    try {
      const accessToken = await this.getAccessToken();
      const messagesResult = await getSessionMessagesSA(sessionId, accessToken);

      if (messagesResult.error) {
        throw new ChatError(messagesResult.error, ChatErrorCode.MESSAGE_LOAD_FAILED, { sessionId });
      }

      if (!messagesResult.messages) {
        return [];
      }

      const rawMessages = messagesResult.messages as ServerChatMessage[];
      const uiMessages: ChatMessage[] = rawMessages.map((msg, index) => ({
        id: `${msg.id || index}`,
        role: msg.role === 'system' ? 'assistant' : (msg.role as 'user' | 'assistant'),
        content: msg.content,
        timestamp: new Date(msg.createdAt),
        model: msg.model,
      }));

      return uiMessages;
    } catch (error) {
      if (error instanceof ChatError) {
        throw error;
      }
      throw new ChatError(
        'メッセージの読み込み中にエラーが発生しました',
        ChatErrorCode.MESSAGE_LOAD_FAILED,
        { sessionId, error }
      );
    }
  }

  startNewSession(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async startNewChat(params: SendMessageParams): Promise<SendMessageResponse> {
    const response = await startChatSA({
      userMessage: params.content,
      model: params.model,
      liffAccessToken: params.accessToken,
      systemPrompt: params.systemPrompt,
    });

    return {
      message: response.message,
      sessionId: response.sessionId as string | undefined,
      error: response.error as string | undefined,
      requiresSubscription: response.requiresSubscription as boolean | undefined,
    };
  }

  private async continueChat(params: SendMessageParams): Promise<SendMessageResponse> {
    if (!params.sessionId) {
      throw new Error('セッションIDが必要です');
    }

    const response = await continueChatSA({
      sessionId: params.sessionId,
      messages: params.messages,
      userMessage: params.content,
      model: params.model,
      liffAccessToken: params.accessToken,
      systemPrompt: params.systemPrompt,
    });

    return {
      message: response.message,
      sessionId: (response.sessionId || params.sessionId) as string | undefined,
      error: response.error as string | undefined,
      requiresSubscription: response.requiresSubscription as boolean | undefined,
    };
  }

  private async getAccessToken(): Promise<string> {
    try {
      if (!this.accessTokenProvider) {
        throw new ChatError(
          'アクセストークンプロバイダーが設定されていません',
          ChatErrorCode.AUTHENTICATION_FAILED
        );
      }
      return await this.accessTokenProvider();
    } catch (error) {
      if (error instanceof ChatError) {
        throw error;
      }
      throw new ChatError(
        'アクセストークンの取得に失敗しました',
        ChatErrorCode.AUTHENTICATION_FAILED,
        { error }
      );
    }
  }

  private handleError(error: unknown): string {
    if (error instanceof ChatError) {
      return error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return '予期せぬエラーが発生しました';
  }
}
