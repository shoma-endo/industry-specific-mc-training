import { NextRequest } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { chatService } from '@/server/services/chatService';
import { env } from '@/env';
import { MODEL_CONFIGS } from '@/lib/constants';
import { ChatError } from '@/domain/errors/ChatError';
import { getSystemPrompt } from '@/lib/prompts';

export const runtime = 'nodejs';

interface StreamRequest {
  sessionId?: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  userMessage: string;
  model: string;
}

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const sendSSE = (event: string, data: unknown) => {
    return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const sendPing = () => {
    return encoder.encode(`event: ping\ndata: {}\n\n`);
  };

  try {
    const { sessionId, messages, userMessage, model }: StreamRequest = await req.json();

    // 認証チェック
    const authHeader = req.headers.get('authorization');
    const liffAccessToken = authHeader?.replace('Bearer ', '');

    const authResult = await authMiddleware(liffAccessToken);
    if (authResult.error) {
      return new Response(sendSSE('error', { type: 'auth', message: authResult.error }), {
        status: 401,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-store',
          Connection: 'keep-alive',
        },
      });
    }

    const { userId } = authResult;

    // 共有サービスのプロンプト取得を利用

    // Anthropic用のメッセージ形式に変換
    const anthropicMessages = [
      ...messages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: userMessage },
    ];

    // ReadableStreamを作成
    const stream = new ReadableStream({
      async start(controller) {
        let fullMessage = '';
        let abortController: AbortController | null = new AbortController();
        let idleTimeout: ReturnType<typeof setTimeout> | null = null;
        let pingInterval: ReturnType<typeof setInterval> | null = null;

        const resetIdleTimeout = () => {
          if (idleTimeout) clearTimeout(idleTimeout);
          idleTimeout = setTimeout(() => {
            console.warn('[Anthropic Stream] Idle timeout reached');
            abortController?.abort();
          }, 360000); // 360秒（6分）のアイドルタイムアウト
        };

        const cleanup = () => {
          if (idleTimeout) clearTimeout(idleTimeout);
          if (pingInterval) clearInterval(pingInterval);
          abortController = null;
        };

        try {
          // ping送信でアイドル切断を防ぐ
          pingInterval = setInterval(() => {
            if (!abortController?.signal.aborted) {
              controller.enqueue(sendPing());
            }
          }, 30000);

          resetIdleTimeout();

          // モデル設定の解決（constantsの設定を優先）
          const cfg = MODEL_CONFIGS[model];
          const resolvedModel =
            cfg && cfg.provider === 'anthropic'
              ? cfg.actualModel
              : model.includes('claude')
                ? model
                : 'claude-sonnet-4-20250514';
          const resolvedMaxTokens = cfg && cfg.provider === 'anthropic' ? cfg.maxTokens : 6000;
          const resolvedTemperature = cfg && cfg.provider === 'anthropic' ? cfg.temperature : 0.3;

          const systemPrompt = await getSystemPrompt(model, liffAccessToken || undefined);

          const anthropicStream = await anthropic.messages.stream(
            {
              model: resolvedModel,
              max_tokens: resolvedMaxTokens,
              temperature: resolvedTemperature,
              system: systemPrompt,
              ...(cfg?.top_p ? { top_p: cfg.top_p } : {}),
              messages: anthropicMessages,
            },
            {
              signal: abortController.signal,
            }
          );

          for await (const chunk of anthropicStream) {
            if (abortController?.signal.aborted) break;

            resetIdleTimeout();

            if (chunk.type === 'content_block_delta') {
              if (chunk.delta.type === 'text_delta') {
                const textChunk = chunk.delta.text;
                fullMessage += textChunk;
                controller.enqueue(sendSSE('chunk', textChunk));
              }
            } else if (chunk.type === 'message_delta') {
              if (chunk.usage) {
                const usage = {
                  inputTokens: chunk.usage.input_tokens || 0,
                  outputTokens: chunk.usage.output_tokens || 0,
                  totalTokens: (chunk.usage.input_tokens || 0) + (chunk.usage.output_tokens || 0),
                };
                controller.enqueue(sendSSE('usage', usage));
              }
            } else if (chunk.type === 'message_stop') {
              // 完了時にメッセージをデータベースに保存
              try {
                let result;
                if (sessionId) {
                  result = await chatService.continueChat(
                    userId,
                    sessionId,
                    [userMessage, fullMessage], // 再生成を回避
                    '',
                    [],
                    model
                  );
                } else {
                  result = await chatService.startChat(
                    userId,
                    'あなたは優秀なAIアシスタントです。',
                    [userMessage, fullMessage],
                    model
                  );
                }

                controller.enqueue(
                  sendSSE('final', {
                    message: fullMessage,
                    sessionId: result.sessionId || sessionId,
                  })
                );
              } catch (saveError) {
                console.error('Failed to save chat message:', saveError);
                controller.enqueue(
                  sendSSE('error', {
                    type: 'save_failed',
                    message: 'メッセージの保存に失敗しましたが、応答は正常に生成されました',
                  })
                );
              }

              controller.enqueue(sendSSE('done', {}));
              if (pingInterval) clearInterval(pingInterval);
              cleanup();
              controller.close();
              return;
            }
          }

          if (pingInterval) clearInterval(pingInterval);
          cleanup();
          controller.close();
        } catch (error: unknown) {
          if (pingInterval) clearInterval(pingInterval);
          cleanup();

          console.error('Anthropic streaming error:', error);

          // 詳細なAnthropicエラーへマッピング
          const ce = ChatError.fromApiError(error, { provider: 'anthropic' });
          controller.enqueue(
            sendSSE('error', {
              type: ce.code,
              message: ce.userMessage,
            })
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('Stream setup error:', error);
    return new Response(
      sendSSE('error', {
        type: 'setup_error',
        message: 'ストリーミングの初期化に失敗しました',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-store',
          Connection: 'keep-alive',
        },
      }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
