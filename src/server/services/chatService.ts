import { OpenAIMessage, OpenAIResponse, ChatRole } from '@/types/chat';
import { openAiService } from './openAiService';
import { chatRepository } from './chatRepository';

/**
 * チャットサービス: AIとのチャット機能とメッセージの保存を提供
 */
export const chatService = {
  /**
   * 新しいチャットを開始し、最初のメッセージを送信する
   */
  async startChat(
    userId: string,
    systemPrompt: string,
    userMessage: string,
    model: string = 'gpt-4o'
  ): Promise<OpenAIResponse & { sessionId: string }> {
    try {
      const title = userMessage.length > 30 
        ? `${userMessage.substring(0, 30)}...` 
        : userMessage;
      
      const session = await chatRepository.createSession(
        userId,
        title,
        systemPrompt
      );

      if (systemPrompt) {
        await chatRepository.createMessage({
          userId,
          sessionId: session.id,
          role: ChatRole.SYSTEM,
          content: systemPrompt,
          createdAt: Date.now(),
        });
      }

      await chatRepository.createMessage({
        userId,
        sessionId: session.id,
        role: ChatRole.USER,
        content: userMessage,
        createdAt: Date.now(),
      });

      const response = await openAiService.startChat(systemPrompt, userMessage, model);

      if (!response.error) {
        await chatRepository.createMessage({
          userId,
          sessionId: session.id,
          role: ChatRole.ASSISTANT,
          content: response.message,
          model,
          createdAt: Date.now(),
        });
      }

      return {
        ...response,
        sessionId: session.id,
      };
    } catch (error) {
      console.error('Chat service error:', error);
      return {
        message: '',
        error: 'チャットの開始に失敗しました',
        sessionId: '',
      };
    }
  },

  /**
   * 既存のチャットに新しいメッセージを追加する
   */
  async continueChat(
    userId: string,
    sessionId: string,
    userMessage: string,
    previousMessages: OpenAIMessage[],
    model: string = 'gpt-4o'
  ): Promise<OpenAIResponse> {
    try {
      await chatRepository.createMessage({
        userId,
        sessionId,
        role: ChatRole.USER,
        content: userMessage,
        createdAt: Date.now(),
      });

      const response = await openAiService.continueChat(previousMessages, userMessage, model);

      if (!response.error) {
        await chatRepository.createMessage({
          userId,
          sessionId,
          role: ChatRole.ASSISTANT,
          content: response.message,
          model,
          createdAt: Date.now(),
        });
      }

      return response;
    } catch (error) {
      console.error('Chat service error:', error);
      return {
        message: '',
        error: 'チャットの継続に失敗しました',
      };
    }
  },

  /**
   * セッションの全メッセージを取得する
   */
  async getSessionMessages(sessionId: string) {
    return chatRepository.getSessionMessages(sessionId);
  },

  /**
   * ユーザーのすべてのチャットセッションを取得する
   */
  async getUserSessions(userId: string) {
    return chatRepository.getUserSessions(userId);
  },
};
