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
  freeFormUserPrompt?: string;
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
      freeFormUserPrompt,
      webSearchConfig = {},
    }: CanvasStreamRequest = await req.json();
    const normalizedFreeFormPrompt =
      typeof freeFormUserPrompt === 'string' ? freeFormUserPrompt.trim() : undefined;
    const enableWebSearchRequested = enableWebSearch ?? false;
    const shouldEnableWebSearch =
      normalizedFreeFormPrompt !== undefined
        ? normalizedFreeFormPrompt.includes('検索')
        : enableWebSearchRequested;

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
      '',
      '## 編集の進め方',
      '**ステップ1：** 下記の「現在の文章全体」を確認する',
      '**ステップ2：** 「ユーザーが選択した範囲」に対する改善指示を適用する',
      '**ステップ3：** 選択範囲外の部分も含めて、文章全体の整合性を確認し適宜修正する',
      '**ステップ4：** apply_full_text_replacement で文章全体（冒頭〜末尾）を完全に出力する',
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
      '改善を適用した上で、**文章全体を省略なく完全に出力してください。**',
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
          idleTimeout = setTimeout(() => {
            console.warn('[Canvas Stream] Idle timeout reached');
            abortController?.abort();
          }, 300000); // 300秒（5分）のアイドルタイムアウト
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

          // ✅ 第1段階: Web検索の実行（shouldEnableWebSearchがtrueの場合のみ）
          let searchResults = '';
          if (shouldEnableWebSearch) {
            try {
              console.log('[Canvas Web Search] Starting web search phase...');

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
                  console.log(
                    '[Canvas Web Search] Search event:',
                    JSON.stringify(event.content_block)
                  );
                }

                if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                  searchResults += event.delta.text;
                }
              }

              console.log(
                '[Canvas Web Search] Search completed. Results length:',
                searchResults.length
              );
            } catch (searchError) {
              console.error('[Canvas Web Search] Search failed:', searchError);
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
              console.log(
                '[Canvas Edit Debug] content_block_start:',
                JSON.stringify(event.content_block)
              );
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

              // ✅ 第3段階: 編集内容の分析（検証結果と修正内容）
              const formatInstructions = shouldEnableWebSearch
                ? [
                    '以下のフォーマットでプレーンテキスト（Markdownの太字・箇条書き・見出しは禁止）として出力してください。',
                    '',
                    '1. 1行目に【検証結果】とだけ記載する。',
                    '2. 2行目に検証結果の本文を記載する（Web検索の判断を含める）。',
                    '3. 次の行は空行を1つ入れる。',
                    '4. 次の行に【主な修正内容】と記載する。',
                    '5. 以降は「削除 - 内容。理由。」「変更 - Before→After。理由。」「追加 - 内容。理由。」の形式で必要な項目だけを記載する。不要な項目は記載しない。',
                    '6. 各行の先頭に余計な記号を付けず、行末で改行する。必要最小限の行数でまとめる。各行の末尾で改行する。',
                  ]
                : [
                    '以下のフォーマットでプレーンテキスト（Markdownの太字・箇条書き・見出しは禁止）として出力してください。',
                    '',
                    '1. 1行目に【主な修正内容】と記載する。',
                    '2. 以降は「削除 - 内容。理由。」「変更 - Before→After。理由。」「追加 - 内容。理由。」の形式で必要な項目だけを記載する。不要な項目は記載しない。',
                    '3. 各行の先頭に余計な記号を付けず、行末で改行する。必要最小限の行数でまとめる。各行の末尾で改行する。',
                  ];

              const analysisSystemPrompt = [
                '# 文章編集内容の分析専門モード',
                '',
                '## あなたの役割',
                '編集前後の文章を比較し、検証結果と主要な変更点を簡潔にまとめます。',
                '',
                '## 出力形式',
                ...formatInstructions,
                '',
                '---',
                '',
                '## 編集前の文章全体',
                '```markdown',
                canvasContent,
                '```',
                '',
                '## 編集後の文章全体',
                '```markdown',
                fullMarkdown,
                '```',
                '',
                '## ユーザーが選択した範囲（この部分を改善した）',
                '```',
                selectedText,
                '```',
                '',
                '## ユーザーの改善指示',
                instruction,
                '',
                ...(searchResults
                  ? ['## Web検索で取得した情報', '```', searchResults, '```', '']
                  : []),
                '上記の情報を元に、何が変更されたか、なぜ変更したかを分析して、指示したフォーマットのプレーンテキストで出力してください。',
              ]
                .filter(Boolean)
                .join('\n');

              const analysisStream = await anthropic.messages.stream({
                model: actualModel,
                max_tokens: 500, // 簡潔な出力のためトークン数を削減
                temperature: 0.3,
                system: [
                  {
                    type: 'text',
                    text: analysisSystemPrompt,
                  },
                ],
                messages: [
                  {
                    role: 'user',
                    content: shouldEnableWebSearch
                      ? '編集内容を分析して、指定したフォーマットで検証結果と主な修正内容をプレーンテキストで出力してください。1行目に【検証結果】、次の行に本文、その次の行で空行を1つ入れ、次の行に【主な修正内容】、以降の行で「削除/変更/追加 - ...」の形式で記載し、各行の末尾で改行してください。Markdownの装飾は禁止です。必要最小限の行数でまとめてください。'
                      : '編集内容を分析して、指定したフォーマットで主な修正内容のみをプレーンテキストで出力してください。1行目に【主な修正内容】、以降の行で「削除/変更/追加 - ...」の形式で記載し、各行の末尾で改行してください。Markdownの装飾は禁止です。必要最小限の行数でまとめてください。',
                  },
                ],
              });

              let analysisResult = '';
              for await (const analysisEvent of analysisStream) {
                if (abortController?.signal.aborted) break;
                resetIdleTimeout();

                if (
                  analysisEvent.type === 'content_block_delta' &&
                  analysisEvent.delta.type === 'text_delta'
                ) {
                  analysisResult += analysisEvent.delta.text;
                  controller.enqueue(
                    sendSSE('analysis_chunk', { content: analysisEvent.delta.text })
                  );
                }
              }

              console.log('[Canvas Analysis] Analysis completed. Length:', analysisResult.length);

              // ✅ チャット履歴に2つのアシスタントメッセージを別々に保存
              // continueChat は必ずユーザーメッセージとアシスタントメッセージのペアを保存するため、
              // 1回だけ呼び出してユーザーメッセージを保存し、2つのアシスタントメッセージは別々に保存する

              // 1つ目: Canvas編集結果（blog_creation_${targetStep}）
              const canvasModel = `blog_creation_${targetStep}`;
              await chatService.continueChat(
                userId!,
                sessionId,
                [instruction, fullMarkdown],
                '', // systemPromptは履歴に保存しない
                [],
                canvasModel
              );

              // 2つ目: 分析結果（blog_creation_improvement）
              // アシスタントメッセージのみを追加保存（ユーザーメッセージは既に上で保存済み）
              if (analysisResult) {
                const assistantAnalysisMessage = {
                  id: crypto.randomUUID(),
                  user_id: userId!,
                  session_id: sessionId,
                  role: 'assistant' as const,
                  content: analysisResult,
                  model: 'blog_creation_improvement',
                  created_at: Date.now() + 2, // Canvas編集結果の後に表示されるよう順序を保証
                };

                // Supabaseに直接保存
                const { SupabaseService } = await import('@/server/services/supabaseService');
                const supabaseService = new SupabaseService();
                await supabaseService.createChatMessage(assistantAnalysisMessage);
              }

              controller.enqueue(sendSSE('done', { fullMarkdown, analysis: analysisResult }));
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
