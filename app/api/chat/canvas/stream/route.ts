import { NextRequest } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { chatService } from '@/server/services/chatService';
import { env } from '@/env';
import { MODEL_CONFIGS } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 800;

interface CanvasStreamRequest {
  sessionId: string;
  instruction: string;
  selectedText: string;
  canvasMarkdown: string;
  targetStep: string;
}

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

// Tool Use スキーマ定義
const CANVAS_EDIT_TOOL = {
  name: 'apply_full_text_replacement',
  description:
    '文章全体を置き換えます。必ずこのツールを使用して、編集後の完全なMarkdown文章を返してください。',
  input_schema: {
    type: 'object' as const,
    properties: {
      full_markdown: {
        type: 'string',
        description: '編集後の完全なMarkdown文章（省略なし、最初から最後まで全文）',
      },
    },
    required: ['full_markdown'],
  },
};

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  let eventId = 0;

  const sendSSE = (event: string, data: unknown) => {
    return encoder.encode(`id: ${++eventId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const sendPing = () => {
    return encoder.encode(`id: ${++eventId}\nevent: ping\ndata: {}\n\n`);
  };

  try {
    const {
      sessionId,
      instruction,
      selectedText,
      canvasMarkdown,
      targetStep,
    }: CanvasStreamRequest = await req.json();

    // 認証チェック
    const authHeader = req.headers.get('authorization');
    const liffAccessToken = authHeader?.replace('Bearer ', '');

    const authResult = await authMiddleware(liffAccessToken);
    if (authResult.error || authResult.requiresSubscription) {
      return new Response(
        sendSSE('error', {
          type: 'auth',
          message: authResult.error || 'サブスクリプションが必要です',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-store',
            Connection: 'keep-alive',
          },
        }
      );
    }

    const { userId } = authResult;

    // MODEL_CONFIGSから設定を取得
    const modelKey = `blog_creation_${targetStep}`;
    const modelConfig = MODEL_CONFIGS[modelKey];

    if (!modelConfig) {
      return new Response(
        sendSSE('error', { type: 'config', message: `モデル設定が見つかりません: ${modelKey}` }),
        { status: 400, headers: { 'Content-Type': 'text/event-stream' } }
      );
    }

    if (modelConfig.provider !== 'anthropic') {
      return new Response(
        sendSSE('error', {
          type: 'config',
          message: `Canvas編集はAnthropicモデルのみサポートしています: ${modelKey}`,
        }),
        { status: 400, headers: { 'Content-Type': 'text/event-stream' } }
      );
    }

    const { maxTokens, temperature, actualModel } = modelConfig;

    // システムプロンプト
    const systemPrompt = [
      '# Canvas編集専用モード',
      '',
      '## あなたの役割',
      'あなたは選択範囲の改善指示を受けて、**文章全体を最適化して全文を出力する**専門エディターです。',
      '',
      '## 絶対に守るべきルール（最重要）',
      '1. **必ず apply_full_text_replacement ツールを使用してください。**',
      '2. **full_markdown には文章全体を必ず全文入れてください。一切省略してはいけません。**',
      '3. 「...（省略）...」「以下同様」などの省略表現は絶対に使用禁止です。',
      '4. 選択範囲だけでなく、文章の最初から最後まで、すべてのセクションを含めてください。',
      '5. 出力は通常のブログ記事と同じMarkdown形式にしてください。',
      '',
      '## 編集方針',
      '- ユーザーが選択した範囲を、指示に従って改善します。',
      '- 選択範囲の編集が文章全体の流れや一貫性を損なわないよう、必要に応じて選択範囲外の部分も調整してください。',
      '- 表現の統一、接続詞の調整、冗長性の削除など、全体の品質向上を図ってください。',
      '',
      '## ユーザーが選択した範囲',
      '```',
      selectedText,
      '```',
      '',
      '## 現在の文章全体',
      '```markdown',
      canvasMarkdown,
      '```',
    ]
      .filter(Boolean)
      .join('\n');

    // ReadableStreamを作成
    const stream = new ReadableStream({
      async start(controller) {
        let fullMarkdown = '';
        let abortController: AbortController | null = new AbortController();
        let idleTimeout: ReturnType<typeof setTimeout> | null = null;
        let pingInterval: ReturnType<typeof setInterval> | null = null;

        // 初回バイト送出（SSEタイムアウト回避）
        controller.enqueue(encoder.encode(`: open\n\n`));

        const resetIdleTimeout = () => {
          if (idleTimeout) clearTimeout(idleTimeout);
          idleTimeout = setTimeout(
            () => {
              console.warn('[Canvas Stream] Idle timeout reached');
              abortController?.abort();
            },
            300000
          ); // 300秒（5分）のアイドルタイムアウト
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
              resetIdleTimeout();
            }
          }, 30000); // 30秒ごとにping

          resetIdleTimeout();

          // Anthropic Streaming API 呼び出し
          const apiStream = await anthropic.messages.stream({
            model: actualModel,
            max_tokens: maxTokens,
            temperature,
            system: [
              {
                type: 'text',
                text: systemPrompt,
                cache_control: { type: 'ephemeral' },
              },
            ],
            tools: [
              {
                ...CANVAS_EDIT_TOOL,
                cache_control: { type: 'ephemeral' },
              },
            ],
            tool_choice: { type: 'tool', name: 'apply_full_text_replacement' },
            messages: [
              {
                role: 'user',
                content: [{ type: 'text', text: instruction }],
              },
            ],
          });

          // ストリーミングデータを処理
          for await (const event of apiStream) {
            if (abortController?.signal.aborted) break;

            resetIdleTimeout();

            if (event.type === 'content_block_delta') {
              if (event.delta.type === 'input_json_delta') {
                const chunk = event.delta.partial_json;
                controller.enqueue(sendSSE('chunk', { content: chunk }));
                fullMarkdown += chunk;
              }
            }

            if (event.type === 'message_stop') {
              // Tool Useの結果を抽出
              const message = await apiStream.finalMessage();
              const toolUseBlock = message.content.find(
                block => block.type === 'tool_use' && block.name === 'apply_full_text_replacement'
              );

              if (toolUseBlock && toolUseBlock.type === 'tool_use') {
                const toolInput = toolUseBlock.input as { full_markdown?: string };
                fullMarkdown = toolInput.full_markdown || '';
              }

              // チャット履歴に保存
              const model = `blog_creation_${targetStep}`;
              await chatService.continueChat(
                userId!,
                sessionId,
                [instruction, fullMarkdown],
                '', // systemPromptは履歴に保存しない
                [],
                model
              );

              controller.enqueue(sendSSE('done', { fullMarkdown }));
            }
          }

          cleanup();
          controller.close();
        } catch (error) {
          cleanup();
          console.error('[Canvas Stream] Error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Canvas編集に失敗しました';
          controller.enqueue(sendSSE('error', { type: 'stream', message: errorMessage }));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('[Canvas Stream] Setup error:', error);
    const errorMessage = error instanceof Error ? error.message : '予期せぬエラーが発生しました';
    return new Response(sendSSE('error', { type: 'setup', message: errorMessage }), {
      status: 500,
      headers: {
        'Content-Type': 'text/event-stream',
      },
    });
  }
}
