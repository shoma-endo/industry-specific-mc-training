import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { ChatError } from '@/domain/errors/ChatError';
import { env } from '@/env';

interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  // Note: seed/top_p are configured in MODEL_CONFIGS but not currently used
  // Future implementation: use provider(model).withSettings({ seed, topP }) if needed
  /**
   * LLM呼び出しのタイムアウト（ミリ秒）。未指定時は 300000ms。
   */
  timeoutMs?: number;
}

export class LLMService {
  private openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

  async llmChat(
    providerKey: 'openai' | 'anthropic',
    model: string,
    messages: LLMMessage[],
    opts: LLMOptions = {}
  ): Promise<string> {
    const startTime = Date.now();

    try {
      const provider = this.openai;

      // 先頭に system があれば分離
      let systemPrompt: string | undefined;
      let chatMessages = messages;
      if (messages[0]?.role === 'system') {
        systemPrompt = messages[0].content;
        chatMessages = messages.slice(1) as Exclude<LLMMessage, { role: 'system' }>[];
      }

      const llmPromise = generateText({
        model: provider(model),
        ...(systemPrompt && { system: systemPrompt }), // Anthropic 用
        // OpenAI も system プロパティをそのまま受け取れる
        messages: chatMessages,
        temperature: opts.temperature ?? 0.7,
        maxTokens: opts.maxTokens ?? 3000,
      });

      // タイムアウト（デフォルト300秒）
      const result = await Promise.race([
        llmPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), opts.timeoutMs ?? 300000)
        ),
      ]);

      const latency = Date.now() - startTime;
      console.log(
        `LLM Chat - Provider: ${providerKey}, Model: ${model}, Latency: ${latency}ms, Tokens: ${result.usage?.totalTokens || 'N/A'}`
      );

      return result.text;
    } catch (error) {
      const latency = Date.now() - startTime;
      console.error(
        `LLM Chat Error - Provider: ${providerKey}, Model: ${model}, Latency: ${latency}ms, Error:`,
        error
      );

      // すべてのプロバイダでフォールバックは行わず、発生したエラーをそのままユーザー向けにマッピング
      throw ChatError.fromApiError(error, { provider: providerKey, model });
    }
  }
}

export const llmService = new LLMService();
export const llmChat = llmService.llmChat.bind(llmService);
