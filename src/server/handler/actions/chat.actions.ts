'use server';

import { z } from 'zod';
import { chatService } from '@/server/services/chatService';
import { openAiService, ChatMessage } from '@/server/services/openAiService';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import {
  SYSTEM_PROMPT,
  KEYWORD_CATEGORIZATION_PROMPT,
  AD_COPY_PROMPT,
  AD_COPY_FINISHING_PROMPT,
  GOOGLE_SEARCH_TITLE_CATEGORIZATION_PROMPT,
} from '@/lib/prompts';
import { googleSearchAction } from '@/server/handler/actions/googleSearch.actions';
import { ChatResponse } from '@/types/chat';
import { formatAdTitles, formatSemrushAds } from '@/lib/adExtractor';
import { semrushService } from '@/server/services/semrushService';
import { ERROR_MESSAGES } from '@/lib/constants';

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
  'gpt-4.1-nano-2025-04-14': AD_COPY_FINISHING_PROMPT,
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

function extractKeywordSections(text: string): { immediate: string[]; later: string[] } {
  const extractSection = (source: string | undefined): string[] =>
    source
      ?.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0) ?? [];

  const matchBetween = text.match(/【今すぐ客キーワード】([\s\S]*?)【後から客キーワード】/);
  const matchImmediateOnly = text.match(/【今すぐ客キーワード】([\s\S]*)/);
  const matchLater = text.match(/【後から客キーワード】([\s\S]*)$/);

  let immediate: string[] = [];
  let later: string[] = [];

  if (matchBetween) {
    immediate = extractSection(matchBetween[1]);
    later = extractSection(matchLater?.[1]); // 後から客も一応再チェック
  } else if (matchImmediateOnly) {
    immediate = extractSection(matchImmediateOnly[1]);
  } else if (matchLater) {
    later = extractSection(matchLater[1]);
  } else {
    // キーワードだけが渡されているケース（ラベルなし）
    immediate = extractSection(text);
  }

  return { immediate, later };
}


function filterByTitleMissingQuery(
  results: { query: string; titles: string }[]
): { query: string; titles: string }[] {
  return results.filter(({ query, titles }) => !titles.includes(query));
}

async function generateAIResponsesFromTitles(
  input: { query: string; titles: string }[]
): Promise<{ query: string; aiMessage: string }[]> {
  const tasks = input.map(async ({ query, titles }) => {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: GOOGLE_SEARCH_TITLE_CATEGORIZATION_PROMPT,
      },
      {
        role: 'user',
        content: titles,
      },
    ];

    const response = await openAiService.sendMessage(
      messages,
      'ft:gpt-4o-mini-2024-07-18:personal::BLnZBIRz',
      0,
      1
    );
    return {
      query,
      aiMessage: response.message,
    };
  });

  return await Promise.all(tasks);
}

function extractFalseQueries(
  responses: { query: string; aiMessage: string }[]
): string {
  return responses
    .filter(res => res.aiMessage.trim().toLowerCase() === 'false')
    .map(res => res.query)
    .join('\n');
}

function subtractMultilineStrings(
  beforeKeywords: string,
  afterKeywords: string
): { remaining: string; removed: string } {
  const beforeList = beforeKeywords
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const afterSet = new Set(
    afterKeywords
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
  );

  const remaining: string[] = [];
  const removed: string[] = [];

  for (const keyword of beforeList) {
    if (afterSet.has(keyword)) {
      remaining.push(keyword);
    } else {
      removed.push(keyword);
    }
  }

  return {
    remaining: remaining.join('\n'),
    removed: removed.join('\n'),
  };
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
    .split(/\r?\n\s*\r?\n/) // 空行をブロック区切りとみなす
    .map(b => b.trim()) // 前後の空白を除去
    .filter(b => b.length > 0); // 空要素は除外

  return (
    blocks
      .map(block => {
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
      .filter((item): item is { headline: string; description: string } => item !== null)
  );
}

async function handleGoogleSearch(
  userMessages: string[],
  liffAccessToken: string
): Promise<{ query: string; titles: string }[]> {
  const searchPromises = userMessages.map(async (query) => {
    try {
      const result = await googleSearchAction({ liffAccessToken, query });

      if (result.error) {
        console.error(`Error searching for "${query}": ${result.error}`);
        return { query, titles: '' }; // エラー時は空文字列
      }

      const titles = formatAdTitles(result.items || []);
      return { query, titles };
    } catch (error) {
      console.error(`Critical error searching for "${query}":`, error);
      return { query, titles: '' }; // 予期せぬエラー時も空文字列
    }
  });

  const resultsArray = await Promise.all(searchPromises);
  return resultsArray;
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
  // --- FTモデル／標準チャット分岐 ---
  const systemPrompt = SYSTEM_PROMPTS[model] ?? SYSTEM_PROMPT;

  // --- モデルによる分岐 ---
  if (model === 'ft:gpt-4o-mini-2024-07-18:personal::BLnZBIRz') {
    const result = await openAiService.startChat(systemPrompt, userMessage, model);
    const classificationKeywords = result.message === '今すぐ客キーワード' ? userMessage : result.message;
    const { immediate, later } = extractKeywordSections(classificationKeywords);
    if (immediate.length === 0) {
      return { message: result.message, error: '', requiresSubscription: false };
    }
    const getSearchResults = await handleGoogleSearch(immediate, liffAccessToken);
    const keywords = filterByTitleMissingQuery(getSearchResults);
    const aiResponses = await generateAIResponsesFromTitles(keywords);
    const falseQueries = extractFalseQueries(aiResponses);
    const afterKeywords = subtractMultilineStrings(immediate.join('\n'), falseQueries);
    return await chatService.startChat(
      userId,
      systemPrompt,
      [userMessage, `【今すぐ客キーワード】\n${afterKeywords.remaining}\n\n【後から客キーワード】\n${afterKeywords.removed}${later.join('\n')}`],
    );
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
    // --- FTモデル／標準チャット分岐 ---
    const systemPrompt = SYSTEM_PROMPTS[model] ?? SYSTEM_PROMPT;

    // --- モデルによる分岐 ---
    if (model === 'ft:gpt-4o-mini-2024-07-18:personal::BLnZBIRz') {
      const result = await openAiService.continueChat(
        messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        })),
        userMessage,
        systemPrompt,
        model
      );
      const classificationKeywords = result.message === '今すぐ客キーワード' ? userMessage : result.message;
      const { immediate, later } = extractKeywordSections(classificationKeywords);
      if (immediate.length === 0) {
        return { message: result.message, error: '', requiresSubscription: false };
      }
      const getSearchResults = await handleGoogleSearch(immediate, liffAccessToken);
      const keywords = filterByTitleMissingQuery(getSearchResults);
      const aiResponses = await generateAIResponsesFromTitles(keywords);
      const falseQueries = extractFalseQueries(aiResponses);
      const afterKeywords = subtractMultilineStrings(immediate.join('\n'), falseQueries);
      return await chatService.continueChat(
        userId,
        sessionId,
        [userMessage, `【今すぐ客キーワード】\n${afterKeywords.remaining} \n\n【後から客キーワード】\n${afterKeywords.removed}\n${later.join('\n')}`],
        systemPrompt,
        messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        })),
      );
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
        systemPrompt,
        messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        })),
        'gpt-4.1-nano-2025-04-14',
        userMessage,
        searchResult
      );
    }

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
