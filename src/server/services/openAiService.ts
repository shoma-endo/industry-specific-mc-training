import OpenAI from 'openai';
import { env } from '@/env';

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type ChatResponse = {
  message: string;
  error?: string;
};

export const openAiService = {
  /**
   * チャットメッセージを送信し、AIからの応答を取得します
   * @param messages チャット履歴
   * @param model 使用するモデル
   * @returns AIからの応答
   */
  async sendMessage(
    messages: ChatMessage[],
    model: string = 'gpt-4o-mini-2024-07-18',
    temperature: number = 0.5,
    max_completion_tokens: number = 1000,
    logit_bias?: Record<string, number>
  ): Promise<ChatResponse> {
    try {
      const completion = await openai.chat.completions.create({
        model: model,
        messages: messages,
        temperature: temperature,
        max_completion_tokens: max_completion_tokens,
        ...(logit_bias && { logit_bias })
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('AIからの応答が空でした');
      }

      return {
        message: response,
      };
    } catch (error) {
      console.error('OpenAI API Error:', error);
      return {
        message: '',
        error: 'AIとの通信中にエラーが発生しました',
      };
    }
  },

  /**
   * システムプロンプトを設定してチャットを開始します
   * @param systemPrompt システムプロンプト
   * @param userMessage ユーザーの最初のメッセージ
   * @param model 使用するモデル
   * @returns AIからの応答
   */
  async startChat(
    systemPrompt: string,
    userMessage: string,
    model: string = 'gpt-4.1-nano-2025-04-14'
  ): Promise<ChatResponse> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userMessage,
      },
    ];

    return this.sendMessage(messages, model);
  },

  /**
   * 既存のチャットに新しいメッセージを追加します
   * @param messages 既存のチャット履歴
   * @param userMessage ユーザーの新しいメッセージ
   * @param model 使用するモデル
   * @returns AIからの応答
   */
  async continueChat(
    messages: ChatMessage[],
    userMessage: string,
    systemPrompt: string,
    model: string = 'gpt-4.1-nano-2025-04-14'
  ): Promise<ChatResponse> {
    const updatedMessages: ChatMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...messages,
      {
        role: 'user',
        content: userMessage,
      },
    ];

    return this.sendMessage(updatedMessages, model);
  },
};
