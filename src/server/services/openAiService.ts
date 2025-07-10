import OpenAI from 'openai';
import { env } from '@/env';
import { MODEL_CONFIGS } from '@/lib/constants';

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

export interface JsonSchema extends Record<string, unknown> {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
}

export interface StructuredResponse {
  content: unknown;
  raw: string;
}

export const openAiService = {
  /**
   * チャットメッセージを送信し、AIからの応答を取得します
   * @param messages チャット履歴
   * @param model 使用するモデル
   * @returns AIからの応答
   */
  async sendMessage(
    messages: ChatMessage[],
    model: string = 'gpt-4.1-nano',
    temperature: number = 0.5,
    max_completion_tokens: number = 1000,
    logit_bias?: Record<string, number>
  ): Promise<ChatResponse> {
    try {
      // ===== デバッグ: モデルと最終 max_completion_tokens を出力 =====
      // MODEL_CONFIGS に maxTokens があればそちらを優先
      const modelConfig = MODEL_CONFIGS[model];
      const resolvedMaxTokens = modelConfig?.maxTokens ?? max_completion_tokens;

      try {
        console.log(
          '[OpenAI] model:',
          model,
          'max_completion_tokens(resolved):',
          resolvedMaxTokens,
          'messages_len:',
          messages.length
        );
      } catch {
        /* noop */
      }

      // Claude品質に近づけるため、設定されたパラメータを使用
      const completion = await openai.chat.completions.create({
        model: model,
        messages: messages,
        temperature: temperature,
        max_completion_tokens: resolvedMaxTokens,
        ...(modelConfig?.seed && { seed: modelConfig.seed }),
        ...(modelConfig?.top_p && { top_p: modelConfig.top_p }),
        ...(logit_bias && { logit_bias }),
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
    model: string = 'gpt-4.1-nano',
    temperature: number = 0.5,
    maxTokens: number = 1000
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

    return this.sendMessage(messages, model, temperature, maxTokens);
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
    model: string = 'gpt-4.1-nano',
    temperature: number = 0.5,
    maxTokens: number = 1000
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

    return this.sendMessage(updatedMessages, model, temperature, maxTokens);
  },

  /**
   * 構造化出力を生成（JSON Schema準拠）
   * Claude品質に近づけるため、厳密な構造化出力を実現
   */
  async generateStructuredOutput(
    systemPrompt: string,
    userMessage: string,
    schema: JsonSchema,
    model: string = 'gpt-4.1-nano',
    options: {
      temperature?: number;
      maxTokens?: number;
      retryCount?: number;
    } = {}
  ): Promise<StructuredResponse> {
    const { temperature = 0.3, maxTokens = 2000, retryCount = 3 } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        const modelConfig = MODEL_CONFIGS[model];
        const completion = await openai.chat.completions.create({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'structured_response',
              schema: schema,
            },
          },
          temperature: temperature,
          max_completion_tokens: maxTokens,
          ...(modelConfig?.seed && { seed: modelConfig.seed }),
          ...(modelConfig?.top_p && { top_p: modelConfig.top_p }),
        });

        const rawContent = completion.choices[0]?.message?.content;
        if (!rawContent) {
          throw new Error('AIからの応答が空でした');
        }

        const parsedContent = JSON.parse(rawContent);

        return {
          content: parsedContent,
          raw: rawContent,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`構造化出力生成エラー (試行${attempt + 1}/${retryCount}):`, error);

        if (attempt === retryCount - 1) {
          throw new Error(`構造化出力生成に失敗しました: ${lastError?.message || 'Unknown error'}`);
        }

        // 再試行前の待機時間
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }

    throw new Error(`構造化出力生成に失敗しました: ${lastError?.message || 'Unknown error'}`);
  },

  /**
   * アダプティブ生成（コンテキストに応じてパラメータを調整）
   */
  async generateAdaptive(
    systemPrompt: string,
    userMessage: string,
    context: {
      contentType: 'ad_copy' | 'lp_draft' | 'brief' | 'general';
      complexity: 'simple' | 'medium' | 'complex';
      creativityLevel: 'low' | 'medium' | 'high';
    },
    model: string = 'gpt-4.1-nano'
  ): Promise<ChatResponse> {
    // コンテキストに応じて設定を調整
    const baseConfig = MODEL_CONFIGS[context.contentType] || MODEL_CONFIGS[model];

    let temperature = baseConfig?.temperature || 0.5;
    let maxTokens = baseConfig?.maxTokens || 1000;

    // 複雑性に応じて調整
    if (context.complexity === 'complex') {
      maxTokens = Math.min(maxTokens * 1.5, 4000);
    } else if (context.complexity === 'simple') {
      maxTokens = Math.max(maxTokens * 0.7, 500);
    }

    // 創造性レベルに応じて調整
    if (context.creativityLevel === 'high') {
      temperature = Math.min(temperature + 0.2, 0.9);
    } else if (context.creativityLevel === 'low') {
      temperature = Math.max(temperature - 0.2, 0.1);
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    return this.sendMessage(messages, model, temperature, maxTokens);
  },

  /**
   * RAGに最適化された生成（検索結果を活用）
   */
  async generateWithRAG(
    systemPrompt: string,
    userMessage: string,
    ragContext: string[],
    model: string = 'gpt-4.1-nano',
    options: {
      temperature?: number;
      maxTokens?: number;
      contextWeight?: number;
    } = {}
  ): Promise<ChatResponse> {
    const { temperature = 0.3, maxTokens = 2000, contextWeight = 0.8 } = options;

    // RAGコンテキストを統合
    const contextSection =
      ragContext.length > 0 ? `\n\n## 参考情報\n${ragContext.join('\n\n')}` : '';

    const enhancedSystemPrompt = systemPrompt + contextSection;

    // コンテキストの重要性に応じて温度を調整
    const adjustedTemperature =
      ragContext.length > 0 ? temperature * (1 - contextWeight * 0.3) : temperature;

    const messages: ChatMessage[] = [
      { role: 'system', content: enhancedSystemPrompt },
      { role: 'user', content: userMessage },
    ];

    return this.sendMessage(messages, model, adjustedTemperature, maxTokens);
  },
};
