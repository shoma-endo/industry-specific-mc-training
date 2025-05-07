'use server';

import { z } from 'zod';
import { chatService } from '@/server/services/chatService';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SYSTEM_PROMPT, KEYWORD_CATEGORIZATION_PROMPT, AD_COPY_PROMPT } from '@/lib/prompts';
import { googleSearchAction } from '@/server/handler/actions/googleSearch.actions';
import { ChatResponse } from '@/types/chat';
import { formatAdItems, formatSemrushAds } from '@/lib/adExtractor';
import { SupabaseService } from '@/server/services/supabaseService';
import { semrushService } from '@/server/services/semrushService';
import { ERROR_MESSAGES } from '@/lib/constants';
import { randomUUID } from 'crypto';

const supabaseService = new SupabaseService();

const startChatSchema = z.object({
  userMessage: z.string(),
  model: z.string(),
  liffAccessToken: z.string(),
});

const continueChatSchema = z.object({
  sessionId: z.string(),
  messages: z.array(z.object({ role: z.string(), content: z.string() })),
  userMessage: z.string(),
  model: z.string(),
  liffAccessToken: z.string(),
});

const SYSTEM_PROMPTS: Record<string, string> = {
  'ft:gpt-4o-mini-2024-07-18:personal::BLnZBIRz': KEYWORD_CATEGORIZATION_PROMPT,
  'semrush_search': AD_COPY_PROMPT,
  // TODO: AIモデルは追加時にここに追加
};

// 認証チェックを共通化
async function checkAuth(liffAccessToken: string) {
  const authResult = await authMiddleware(liffAccessToken);
  if (authResult.error || authResult.requiresSubscription) {
    return {
      isError: true as const,
      error: authResult.error,
      requiresSubscription: authResult.requiresSubscription,
    };
  }
  return { isError: false as const, userId: authResult.userId! };
}

/**
 * 改行区切りの「見出し：…」「説明文：…」テキストを
 * JSON 配列にパースする
 *
 * @param input - 改行＋空行で区切られた広告文セット
 */
function parseAdItems(input: string): { headline: string; description: string }[] {
  // 空行（1つ以上の改行）でアイテムを分割
  const blocks = input
    .split(/\r?\n\s*\r?\n/)     // 空行をブロック区切りとみなす
    .map(b => b.trim())         // 前後の空白を除去
    .filter(b => b.length > 0); // 空要素は除外

  return blocks.map(block => {
    // 「見出し：〜」をキャプチャ
    const headlineMatch = block.match(/見出し：(.+)/);
    // 「説明文：〜」をキャプチャ
    const descriptionMatch = block.match(/説明文：(.+)/);
    if (!headlineMatch?.[1] || !descriptionMatch?.[1]) {
      return null;
    }

    return {
      headline: headlineMatch[1].trim(),
      description: descriptionMatch[1].trim(),
    };
  })
  // 見出し／説明文いずれかが取得できなかったブロックは除外
  .filter((item): item is { headline: string; description: string } => item !== null);
}

// google_search モデルの処理
async function handleGoogleSearch(
  userId: string,
  userMessage: string,
  liffAccessToken: string,
  sessionId?: string
): Promise<ChatResponse> {
  // 1) 検索実行
  const { items, error } = await googleSearchAction({ liffAccessToken, query: userMessage });
  if (error) {
    return { message: '', error, requiresSubscription: false };
  }

  let currentSessionId = sessionId;

  // 2) セッションIDがない場合は新規作成 (startChatのケース)
  if (!currentSessionId) {
    currentSessionId = await supabaseService.createChatSession({
      id: randomUUID(),
      user_id: userId,
      title: `Google: ${userMessage.substring(0, 50)}`, // タイトルを変更
      system_prompt: undefined, // google_searchには system_prompt は不要
      last_message_at: Date.now(),
      created_at: Date.now(),
    });
  }

  // 3) ユーザー入力をチャットメッセージとして保存
  await supabaseService.createChatMessage({
    id: randomUUID(),
    user_id: userId,
    session_id: currentSessionId,
    role: 'user',
    content: userMessage,
    model: 'google_search',
    created_at: Date.now(),
  });

  // 4) 検索結果をフォーマットしてチャットメッセージとして保存
  const reply = formatAdItems(items);
  await supabaseService.createChatMessage({
    id: randomUUID(),
    user_id: userId,
    session_id: currentSessionId,
    role: 'assistant',
    content: reply,
    model: 'google_search',
    created_at: Date.now(),
  });

  // 5) セッションの最終メッセージ時刻を更新
  await supabaseService.updateChatSession(currentSessionId, userId, {
    last_message_at: Date.now(),
    // 必要であればタイトルも更新
    // title: `Google: ${userMessage.substring(0, 50)}`
  });

  // 6) クライアントに返却
  return {
    message: reply,
    sessionId: currentSessionId,
    requiresSubscription: false,
  };
}

// semrush_search モデルの処理
async function handleSemrushSearch(userMessage: string): Promise<string> {
  let reply: string; // reply を try の外で宣言
  let fetchError: string | undefined = undefined; // エラーメッセージを保持する変数

  try {
    // 1) Semrushから広告を取得
    const ads = await semrushService.fetchAds(userMessage);
    // fetchAds はエラー時に空配列を返す想定だったが、内部でエラーがスローされるケースがある
    reply = formatSemrushAds(ads); // エラーがない場合に reply を設定
    if (ads.length === 0) {
      reply = ERROR_MESSAGES['ad_not_found'] ?? '';
    }
  } catch (error: unknown) {
    console.error('Error fetching ads from Semrush:', error);
    if (error instanceof Error && error.message === '該当する広告主が見つかりませんでした') {
      // 特定のエラーメッセージをユーザーフレンドリーなメッセージに変換
      reply = ERROR_MESSAGES['ad_not_found'] ?? '';
    } else {
      // その他の予期せぬエラー
      fetchError = ERROR_MESSAGES['ad_acquisition'] ?? '';
      // エラーが発生した場合も、ユーザーには空の応答ではなくエラーメッセージを返す
      reply = fetchError;
    }
  }
  return reply;
}

export async function startChat(data: z.infer<typeof startChatSchema>): Promise<ChatResponse> {
  const { liffAccessToken, userMessage, model } = startChatSchema.parse(data);

  // --- 共通: 認証 ---
  const auth = await checkAuth(liffAccessToken);
  if (auth.isError) {
    return { message: '', error: auth.error, requiresSubscription: auth.requiresSubscription };
  }
  const userId = auth.userId;

  // --- モデルによる分岐 ---
  if (model === 'google_search') {
    return handleGoogleSearch(userId, userMessage, liffAccessToken);
  } else if (model === 'semrush_search') {
    const searchResult = await handleSemrushSearch(userMessage);
    if (
      searchResult === ERROR_MESSAGES['ad_not_found'] ||
      searchResult === ERROR_MESSAGES['ad_acquisition']
    ) {
      return { message: searchResult, error: '', requiresSubscription: false };
    }
    const adItems = parseAdItems(searchResult.replace(/^ドメイン：.*\r?\n?/gm, ''));
    return await chatService.startChat(
      userId,
      SYSTEM_PROMPTS[model] ?? SYSTEM_PROMPT,
      JSON.stringify(adItems),
      'gpt-4.1-nano-2025-04-14',
      userMessage,
      searchResult
    );
  }

  // --- FTモデル／標準チャット分岐 ---
  const systemPrompt = SYSTEM_PROMPTS[model] ?? SYSTEM_PROMPT;
  return chatService.startChat(userId, systemPrompt, userMessage, model);
}

export async function continueChat(
  data: z.infer<typeof continueChatSchema>
): Promise<ChatResponse> {
  const { liffAccessToken, sessionId, messages, userMessage, model } =
    continueChatSchema.parse(data);
  try {
    // --- 共通: 認証 ---
    const auth = await checkAuth(liffAccessToken);
    if (auth.isError) {
      return { message: '', error: auth.error, requiresSubscription: auth.requiresSubscription };
    }
    const userId = auth.userId;

    // --- モデルによる分岐 ---
    if (model === 'google_search') {
      return handleGoogleSearch(userId, userMessage, liffAccessToken, sessionId);
    } else if (model === 'semrush_search') {
      const searchResult = await handleSemrushSearch(userMessage);
      if (
        searchResult === ERROR_MESSAGES['ad_not_found'] ||
        searchResult === ERROR_MESSAGES['ad_acquisition']
      ) {
        return { message: searchResult, error: '', requiresSubscription: false };
      }
      const adItems = parseAdItems(searchResult.replace(/^ドメイン：.*\r?\n?/gm, ''));
      return await chatService.continueChat(
        userId,
        sessionId,
        JSON.stringify(adItems),
        SYSTEM_PROMPTS[model] ?? SYSTEM_PROMPT,
        messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        })),
        'gpt-4.1-nano-2025-04-14',
        userMessage,
        searchResult
      );
    }

    // --- FTモデル／標準チャット分岐 ---
    const systemPrompt = SYSTEM_PROMPTS[model] ?? SYSTEM_PROMPT;
    return chatService.continueChat(
      userId,
      sessionId,
      userMessage,
      systemPrompt,
      messages.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      })),
      model
    );
  } catch (e: unknown) {
    console.error('continueChat failed:', e);
    // ここでユーザー向けにわかりやすい文言を返却する
    return {
      message: '',
      error: (e as Error).message || '予期せぬエラーが発生しました',
      requiresSubscription: false,
    };
  }
}

export async function getChatSessions(liffAccessToken: string) {
  const auth = await checkAuth(liffAccessToken);
  if (auth.isError) {
    return { sessions: [], error: auth.error, requiresSubscription: auth.requiresSubscription };
  }
  const sessions = await chatService.getUserSessions(auth.userId);
  return { sessions, error: null };
}

export async function getSessionMessages(sessionId: string, liffAccessToken: string) {
  const auth = await checkAuth(liffAccessToken);
  if (auth.isError) {
    return { messages: [], error: auth.error, requiresSubscription: auth.requiresSubscription };
  }
  const messages = await chatService.getSessionMessages(sessionId, auth.userId);
  return { messages, error: null };
}
