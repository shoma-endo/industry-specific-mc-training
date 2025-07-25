import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
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
}

export class LLMService {
  private openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
  private anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

  async llmChat(
    providerKey: 'openai' | 'anthropic',
    model: string,
    messages: LLMMessage[],
    opts: LLMOptions = {}
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      const provider = providerKey === 'openai' ? this.openai : this.anthropic;
      
      // 先頭に system があれば分離
      let systemPrompt: string | undefined;
      let chatMessages = messages;
      if (messages[0]?.role === 'system') {
        systemPrompt = messages[0].content;
        chatMessages = messages.slice(1) as Exclude<LLMMessage, { role: 'system' }>[];
      }

      const result = await generateText({
        model: provider(model),
        ...(systemPrompt && { system: systemPrompt }), // Anthropic 用
        // OpenAI も system プロパティをそのまま受け取れる
        messages: chatMessages,
        temperature: opts.temperature ?? 0.7,
        maxTokens: opts.maxTokens ?? 1000,
      });

      const latency = Date.now() - startTime;
      console.log(`LLM Chat - Provider: ${providerKey}, Model: ${model}, Latency: ${latency}ms, Tokens: ${result.usage?.totalTokens || 'N/A'}`);

      return result.text;
    } catch (error) {
      const latency = Date.now() - startTime;
      console.error(`LLM Chat Error - Provider: ${providerKey}, Model: ${model}, Latency: ${latency}ms, Error:`, error);
      
      if (providerKey === 'anthropic') {
        console.log('Anthropic API failed, attempting fallback to OpenAI gpt-4o-mini');
        try {
          // フォールバック時は元のmessages配列をそのまま使用（OpenAIはsystemロール対応）
          const fallbackResult = await generateText({
            model: this.openai('gpt-4o-mini'),
            messages: messages,
            temperature: opts.temperature ?? 0.7,
            maxTokens: opts.maxTokens ?? 1000,
          });
          return fallbackResult.text;
        } catch (fallbackError) {
          console.error('Fallback to OpenAI also failed:', fallbackError);
          throw new Error('AI通信に失敗しました');
        }
      }
      
      throw new Error('AI通信に失敗しました');
    }
  }
}

export const llmService = new LLMService();
export const llmChat = llmService.llmChat.bind(llmService);