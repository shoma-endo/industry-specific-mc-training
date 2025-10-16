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
  canvasContent: string;
  targetStep: string;
  enableWebSearch?: boolean;
  webSearchConfig?: {
    maxUses?: number;
    allowedDomains?: string[];
    blockedDomains?: string[];
  };
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
      canvasContent,
      targetStep,
      enableWebSearch = false,
      webSearchConfig = {},
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
      'あなたは文章編集の専門エディターです。ユーザーが選択した部分の改善指示を受けて、**文章全体を編集して完全な全文を出力**します。',
      '',
      '## 【最重要】出力形式の絶対ルール',
      '1. **必ず apply_full_text_replacement ツールを使用する**',
      '2. **full_markdown パラメータには、編集後の文章全体を最初から最後まで完全に含める**',
      '3. **絶対に省略しない：** 「...（省略）...」「※以下同様」「（中略）」などの表現は禁止',
      '4. **選択範囲以外の部分も必ず全て含める：** タイトル、見出し、本文、すべてのセクションを出力',
      '5. **文章の一部だけを返すことは厳禁：** 必ず冒頭から末尾まで完全な文章を返す',
      '6. **編集後は必ず変更箇所の説明を追記：** 文章の最後に「---」区切りを入れ、検証結果と変更内容を詳細に記載する',
      '',
      '## 編集の進め方',
      '**ステップ1：** 下記の「現在の文章全体」を確認する',
      '**ステップ2：** 「ユーザーが選択した範囲」に対する改善指示を適用する',
      '**ステップ3：** 選択範囲外の部分も含めて、文章全体の整合性を確認し適宜修正する',
      '**ステップ4：** apply_full_text_replacement で文章全体（冒頭〜末尾）を完全に出力する',
      '**ステップ5：** 文章の最後に以下のフォーマットで検証結果と変更内容を追記する',
      '',
      '```',
      '---',
      '',
      '## 検証結果',
      '[選択されたテキストについて、Web検索で具体的に何を調査したか、その結果どう判断したかを記載]',
      '例: 「ビタミンE含有量が約3倍」という記述について、厚生労働省データベース、学術論文、公的機関の栄養データを調査しましたが、この具体的な数値の根拠となる公的なデータは見つかりませんでした。比較対象も不明確です。',
      '',
      '## 修正内容と理由',
      '変更前後の内容を明確に記載し、何をどのように変更したか、なぜその変更をしたかを具体的に説明する',
      '',
      '1. **削除**: 「[削除した具体的な文章]」',
      '   - 理由: [なぜこの部分を削除したのか]',
      '   - 例: 「ビタミンE含有量が約3倍」という記述を削除。エビデンスが確認できず、読者に誤解を与える可能性があるため。',
      '',
      '2. **変更**: 「[変更前の文章]」 → 「[変更後の文章]」',
      '   - 理由: [なぜこのように変更したのか]',
      '   - 例: 「必須アミノ酸のバランスも優れており」→「一般的に認められているメリットの列挙」に変更。読者が自身で判断できる情報を提供するため。',
      '',
      '3. **追加**: 「[追加した具体的な文章]」',
      '   - 理由: [なぜこの部分を追加したのか]',
      '```',
      '',
      '---',
      '',
      '## 現在の文章全体（編集対象）',
      '```markdown',
      canvasContent,
      '```',
      '',
      '## ユーザーが選択した範囲（この部分を改善）',
      '```',
      selectedText,
      '```',
      '',
      '上記の「選択した範囲」に対する改善指示がユーザーメッセージで送られます。',
      '改善を適用した上で、**文章全体を省略なく完全に出力し、最後に変更箇所の説明を必ず追記してください。**',
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

          // ✅ 第1段階: Web検索の実行（enableWebSearchがtrueの場合のみ）
          let searchResults = '';
          let searchQuery = '';
          let searchResultsCount = 0;
          if (enableWebSearch) {
            try {
              console.log('[Canvas Web Search] Starting web search phase...');

              // 検索クエリを生成
              searchQuery = `${selectedText.slice(0, 100)} エビデンス 根拠 データ`;

              controller.enqueue(sendSSE('search_start', { message: 'Web検索を開始しています...' }));
              controller.enqueue(sendSSE('search_query', { query: searchQuery }));

              const searchStream = await anthropic.messages.stream({
                model: actualModel,
                max_tokens: 2000,
                temperature: 0.3,
                system: [
                  {
                    type: 'text',
                    text: 'あなたはWeb検索の専門家です。ユーザーの指示に基づいて、必要な最新情報をweb_searchツールで検索してください。検索結果を簡潔にまとめて返してください。',
                  },
                ],
                tools: [
                  {
                    type: 'web_search_20250305' as const,
                    name: 'web_search' as const,
                    max_uses: webSearchConfig.maxUses || 3,
                    ...(webSearchConfig.allowedDomains && {
                      allowed_domains: webSearchConfig.allowedDomains,
                    }),
                    ...(webSearchConfig.blockedDomains && {
                      blocked_domains: webSearchConfig.blockedDomains,
                    }),
                  },
                ],
                tool_choice: { type: 'tool', name: 'web_search' },
                messages: [
                  {
                    role: 'user',
                    content: `以下の指示に必要な最新情報を検索してください：${instruction}`,
                  },
                ],
              });

              // 検索結果を収集
              for await (const event of searchStream) {
                if (abortController?.signal.aborted) break;
                resetIdleTimeout();

                if (event.type === 'content_block_start') {
                  console.log('[Canvas Web Search] Search event:', JSON.stringify(event.content_block));
                }

                if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                  searchResults += event.delta.text;
                }
              }

              // 検索結果数を推定（簡易的に改行数から推定）
              searchResultsCount = Math.min((searchResults.match(/\n/g) || []).length, webSearchConfig.maxUses || 3);

              console.log('[Canvas Web Search] Search completed. Results length:', searchResults.length);
              controller.enqueue(
                sendSSE('search_complete', {
                  message: 'Web検索が完了しました',
                  resultsLength: searchResults.length,
                  resultsCount: searchResultsCount
                })
              );
            } catch (searchError) {
              console.error('[Canvas Web Search] Search failed:', searchError);
              controller.enqueue(sendSSE('search_error', { message: 'Web検索に失敗しましたが、編集を続行します' }));
              // 検索失敗時は空の結果で続行
              searchResults = '';
            }
          }

          // ✅ 第2段階: Canvas編集（検索結果を含める）
          const finalSystemPrompt = [
            systemPrompt,
            ...(searchResults
              ? [
                  '',
                  '---',
                  '',
                  '## Web検索で取得した最新情報',
                  '```',
                  searchResults,
                  '```',
                  '',
                  '上記の最新情報を活用して、文章を編集してください。',
                ]
              : []),
          ].join('\n');

          // Anthropic Streaming API 呼び出し
          const apiStream = await anthropic.messages.stream({
            model: actualModel,
            max_tokens: maxTokens,
            temperature,
            system: [
              {
                type: 'text',
                text: finalSystemPrompt,
                cache_control: { type: 'ephemeral' },
              },
            ],
            tools: [
              {
                ...CANVAS_EDIT_TOOL,
                cache_control: { type: 'ephemeral' as const },
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

            // デバッグ用ログ
            if (event.type === 'content_block_start') {
              console.log('[Canvas Edit Debug] content_block_start:', JSON.stringify(event.content_block));
            }

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
