import { chatService } from '@/server/services/chatService';
import { openAiService } from '@/server/services/openAiService';
import { ChatProcessorService } from './chatProcessors';
import { semrushService } from '@/server/services/semrushService';
import { formatSemrushAds } from '@/lib/adExtractor';
import { ERROR_MESSAGES, MODEL_CONFIGS } from '@/lib/constants';
import {
  SYSTEM_PROMPT,
  KEYWORD_CATEGORIZATION_PROMPT,
  AD_COPY_PROMPT,
  AD_COPY_FINISHING_PROMPT,
  LP_DRAFT_PROMPT,
  // 新しいキャッシュ戦略対応プロンプト生成関数
  generateAdCopyPrompt,
  generateAdCopyFinishingPrompt,
  generateLpDraftPrompt,
} from '@/lib/prompts';
import { ChatResponse } from '@/types/chat';
import type { StartChatInput, ContinueChatInput } from '../shared/validators';
import { RAGKeywordClassifier } from '@/lib/rag-keyword-classifier';
import { PromptRetrievalService } from '@/server/services/promptRetrievalService';
import { BriefService } from '@/server/services/briefService';
import { PromptService } from '@/services/promptService';

const SYSTEM_PROMPTS: Record<string, string> = {
  'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2': KEYWORD_CATEGORIZATION_PROMPT,
  rag_keyword_classifier: KEYWORD_CATEGORIZATION_PROMPT,
  ad_copy_creation: AD_COPY_PROMPT,
  'gpt-4.1-nano': AD_COPY_FINISHING_PROMPT,
  lp_draft_creation: LP_DRAFT_PROMPT,
};

/**
 * モデルに応じた動的プロンプト取得（React Cache活用）
 */
async function getSystemPrompt(model: string, liffAccessToken?: string): Promise<string> {
  // liffAccessTokenがある場合はキャッシュ戦略を使用
  if (liffAccessToken) {
    switch (model) {
      case 'ad_copy_creation':
        return await generateAdCopyPrompt(liffAccessToken);
      case 'gpt-4.1-nano':
        return await generateAdCopyFinishingPrompt(liffAccessToken);
      case 'lp_draft_creation':
        return await generateLpDraftPrompt(liffAccessToken);
      default:
        return SYSTEM_PROMPTS[model] ?? SYSTEM_PROMPT;
    }
  }

  // フォールバック: 従来の静的プロンプト
  return SYSTEM_PROMPTS[model] ?? SYSTEM_PROMPT;
}

export class ModelHandlerService {
  private processor = new ChatProcessorService();
  private ragClassifier = new RAGKeywordClassifier();

  async handleStart(userId: string, data: StartChatInput): Promise<ChatResponse> {
    const { userMessage, model, liffAccessToken } = data;
    // キャッシュ戦略を活用した動的プロンプト取得
    const systemPrompt = await getSystemPrompt(model, liffAccessToken);

    switch (model) {
      case 'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2':
        return this.handleFTModel(userId, systemPrompt, userMessage, model);
      case 'rag_keyword_classifier':
        return this.handleRAGModel(userId, systemPrompt, userMessage);
      case 'semrush_search':
        return this.handleSemrushModel(userId, systemPrompt, userMessage);
      case 'ad_copy_creation':
        return this.handleAdCopyModel(userId, systemPrompt, userMessage);
      case 'gpt-4.1-nano':
        return this.handleFinishingModel(userId, systemPrompt, userMessage);
      case 'lp_draft_creation':
        return this.handleLPDraftModel(userId, systemPrompt, userMessage);
      default:
        return this.handleDefaultModel(userId, systemPrompt, userMessage, model);
    }
  }

  async handleContinue(userId: string, data: ContinueChatInput): Promise<ChatResponse> {
    const { sessionId, messages, userMessage, model, liffAccessToken } = data;
    // キャッシュ戦略を活用した動的プロンプト取得
    const systemPrompt = await getSystemPrompt(model, liffAccessToken);

    if (model === 'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2') {
      const config = MODEL_CONFIGS[model];
      const actualModel = config ? config.actualModel : model;
      const temperature = config ? config.temperature : 0.5;
      const maxTokens = config ? config.maxTokens : 1000;

      const chatMessages = messages.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));

      const result = await openAiService.continueChat(
        chatMessages,
        userMessage.trim(),
        systemPrompt,
        actualModel,
        temperature,
        maxTokens
      );

      const classificationKeywords =
        result.message === '今すぐ客キーワード' ? userMessage : result.message;
      const { immediate, later } = this.processor.extractKeywordSections(classificationKeywords);

      if (immediate.length === 0) {
        return { message: result.message, error: '', requiresSubscription: false };
      }

      return await chatService.continueChat(
        userId,
        sessionId,
        `【今すぐ客キーワード】\n${immediate.join('\n')}\n\n【後から客キーワード】\n${later.join('\n')}`,
        systemPrompt,
        [],
        model
      );
    } else if (model === 'rag_keyword_classifier') {
      // RAGシステムでの分類処理
      const keywords = this.extractKeywordsFromUserMessage(userMessage);
      const result = await this.ragClassifier.classifyKeywords(keywords, {
        includeEvidence: false,
      });

      const immediate = result.results.immediate_customer.map(k => k.keyword);
      const later = result.results.later_customer.map(k => k.keyword);

      if (immediate.length === 0) {
        const responseMessage = `【今すぐ客キーワード】\n（該当なし）\n\n【後から客キーワード】\n${later.join('\n')}`;
        return await chatService.continueChat(
          userId,
          sessionId,
          responseMessage,
          systemPrompt,
          [],
          model
        );
      }

      return await chatService.continueChat(
        userId,
        sessionId,
        `【今すぐ客キーワード】\n${immediate.join('\n')}\n\n【後から客キーワード】\n${later.join('\n')}`,
        systemPrompt,
        [],
        model
      );
    } else if (model === 'semrush_search') {
      const searchResult = await this.handleSemrushSearch(userMessage);
      if (
        searchResult === ERROR_MESSAGES['ad_not_found'] ||
        searchResult === ERROR_MESSAGES['ad_acquisition']
      ) {
        return { message: searchResult, error: '', requiresSubscription: false };
      }

      const adItems = this.processor.parseAdItems(
        searchResult.replace(/^ドメイン：.*\r?\n?/gm, '')
      );
      return await chatService.continueChat(
        userId,
        sessionId,
        JSON.stringify(adItems),
        systemPrompt,
        [],
        'gpt-4.1-nano',
        userMessage.trim(),
        searchResult
      );
    } else if (model === 'lp_draft_creation') {
      // RAG対応: LP継続生成でもRAG機能を使用
      try {
        // 高速モードフラグ: 短いクエリや一般的なクエリは高速モード
        const fastMode =
          userMessage.length < 50 ||
          ['お願いします', '事業者', 'LP作成してください', 'LP'].some(q =>
            userMessage.toLowerCase().includes(q.toLowerCase())
          );

        if (fastMode) {
          console.log('[Fast Mode] 高速モードでLP継続生成を実行');
        }

        // 並列処理化: RAGシステムメッセージ構築と事業者情報取得を同時実行
        const [ragSystemPrompt, variables] = await Promise.all([
          PromptRetrievalService.buildRagSystemMessage(
            'lp_draft_creation',
            userMessage.trim(),
            undefined,
            { skipQueryOptimization: fastMode }
          ),
          BriefService.getVariablesByUserId(userId),
        ]);

        // 事業者情報による変数置換
        const finalSystemPrompt = PromptService.replaceVariables(ragSystemPrompt, variables);

        const validMessages = messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        }));

        return await chatService.continueChat(
          userId,
          sessionId,
          userMessage,
          finalSystemPrompt,
          validMessages,
          'lp_draft_creation'
        );
      } catch (error) {
        console.error('RAG LP継続生成エラー:', error);

        // 単一のフォールバック処理に簡素化
        const variables = await BriefService.getVariablesByUserId(userId).catch(() => ({}));
        const finalSystemPrompt = PromptService.replaceVariables(systemPrompt, variables);

        const validMessages = messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        }));

        return await chatService.continueChat(
          userId,
          sessionId,
          userMessage,
          finalSystemPrompt,
          validMessages,
          'lp_draft_creation'
        );
      }
    } else {
      return await chatService.continueChat(
        userId,
        sessionId,
        userMessage,
        systemPrompt,
        [],
        model
      );
    }
  }

  private async handleFTModel(
    userId: string,
    systemPrompt: string,
    userMessage: string,
    model: string
  ): Promise<ChatResponse> {
    const config = MODEL_CONFIGS[model];
    const maxTokens = config ? config.maxTokens : 1000;
    const temperature = config ? config.temperature : 0.5;

    const result = await openAiService.startChat(
      systemPrompt,
      userMessage.trim(),
      model,
      temperature,
      maxTokens
    );

    const classificationKeywords =
      result.message === '今すぐ客キーワード' ? userMessage : result.message;
    const { immediate, later } = this.processor.extractKeywordSections(classificationKeywords);

    if (immediate.length === 0) {
      return { message: result.message, error: '', requiresSubscription: false };
    }

    return await chatService.startChat(
      userId,
      systemPrompt,
      `${userMessage}\n\n【今すぐ客キーワード】\n${immediate.join('\n')}\n\n【後から客キーワード】\n${later.join('\n')}`
    );
  }

  private async handleSemrushModel(
    userId: string,
    systemPrompt: string,
    userMessage: string
  ): Promise<ChatResponse> {
    const searchResult = await this.handleSemrushSearch(userMessage);
    if (
      searchResult === ERROR_MESSAGES['ad_not_found'] ||
      searchResult === ERROR_MESSAGES['ad_acquisition']
    ) {
      return { message: searchResult, error: '', requiresSubscription: false };
    }

    const adItems = this.processor.parseAdItems(searchResult.replace(/^ドメイン：.*\r?\n?/gm, ''));
    return await chatService.startChat(
      userId,
      systemPrompt,
      JSON.stringify(adItems),
      'gpt-4.1-nano',
      userMessage.trim(),
      searchResult
    );
  }

  private async handleAdCopyModel(
    userId: string,
    systemPrompt: string,
    userMessage: string
  ): Promise<ChatResponse> {
    return await chatService.startChat(
      userId,
      systemPrompt,
      userMessage.trim(),
      'ad_copy_creation'
    );
  }

  private async handleFinishingModel(
    userId: string,
    systemPrompt: string,
    userMessage: string
  ): Promise<ChatResponse> {
    return await chatService.startChat(userId, systemPrompt, userMessage.trim(), 'gpt-4.1-nano');
  }

  private async handleLPDraftModel(
    userId: string,
    systemPrompt: string,
    userMessage: string
  ): Promise<ChatResponse> {
    try {
      // 高速モードフラグ: 短いクエリや一般的なクエリは高速モード
      const fastMode =
        userMessage.length < 50 ||
        ['お願いします', '事業者', 'LP作成してください', 'LP'].some(q =>
          userMessage.toLowerCase().includes(q.toLowerCase())
        );

      if (fastMode) {
        console.log('[Fast Mode] 高速モードでLP生成を実行');
      }

      // 並列処理化: RAGシステムメッセージ構築と事業者情報取得を同時実行
      const [ragSystemPrompt, variables] = await Promise.all([
        PromptRetrievalService.buildRagSystemMessage(
          'lp_draft_creation',
          userMessage.trim(),
          undefined,
          { skipQueryOptimization: fastMode }
        ),
        BriefService.getVariablesByUserId(userId),
      ]);

      // 事業者情報による変数置換
      const finalSystemPrompt = PromptService.replaceVariables(ragSystemPrompt, variables);

      // チャットサービス経由でセッション保存とRAG版生成
      // 論理キー "lp_draft_creation" を渡すことで maxTokens=5000 が適用される
      return await chatService.startChat(
        userId,
        finalSystemPrompt,
        userMessage.trim(),
        'lp_draft_creation'
      );
    } catch (error) {
      console.error('RAG LP生成エラー:', error);

      // 単一のフォールバック処理に簡素化
      const variables = await BriefService.getVariablesByUserId(userId).catch(() => ({}));
      const finalSystemPrompt = PromptService.replaceVariables(systemPrompt, variables);

      return await chatService.startChat(
        userId,
        finalSystemPrompt,
        userMessage.trim(),
        'lp_draft_creation'
      );
    }
  }

  private async handleDefaultModel(
    userId: string,
    systemPrompt: string,
    userMessage: string,
    model?: string
  ): Promise<ChatResponse> {
    return await chatService.startChat(userId, systemPrompt, userMessage.trim(), model);
  }

  private async handleSemrushSearch(userMessage: string): Promise<string> {
    let reply: string;
    let fetchError: string | undefined = undefined;

    try {
      const ads = await semrushService.fetchAds(userMessage);
      reply = formatSemrushAds(ads);
      if (ads.length === 0) {
        reply = ERROR_MESSAGES['ad_not_found'] ?? '';
      }
    } catch (error: unknown) {
      console.error('Error fetching ads from Semrush:', error);
      if (error instanceof Error && error.message === '該当する広告主が見つかりませんでした') {
        reply = ERROR_MESSAGES['ad_not_found'] ?? '';
      } else {
        fetchError = ERROR_MESSAGES['ad_acquisition'] ?? '';
        reply = fetchError;
      }
    }
    return reply;
  }

  /**
   * RAGモデルの処理（新機能）
   */
  private async handleRAGModel(
    userId: string,
    systemPrompt: string,
    userMessage: string
  ): Promise<ChatResponse> {
    try {
      // ユーザーメッセージからキーワードを抽出
      const keywords = this.extractKeywordsFromUserMessage(userMessage);

      if (keywords.length === 0) {
        return {
          message: 'キーワードが見つかりませんでした。分類するキーワードを入力してください。',
          error: '',
          requiresSubscription: false,
        };
      }

      // RAGシステムで分類実行
      const result = await this.ragClassifier.classifyKeywords(keywords, {
        includeEvidence: false,
      });

      const immediate = result.results.immediate_customer.map(k => k.keyword);
      const later = result.results.later_customer.map(k => k.keyword);

      if (immediate.length === 0) {
        const responseMessage = `【今すぐ客キーワード】\n（該当なし）\n\n【後から客キーワード】\n${later.join('\n')}`;
        return await chatService.startChat(userId, systemPrompt, responseMessage);
      }

      // Google検索による検証（既存の処理と同様）
      return await chatService.startChat(
        userId,
        systemPrompt,
        `${userMessage}\n\n【今すぐ客キーワード】\n${immediate.join('\n')}\n\n【後から客キーワード】\n${later.join('\n')}`
      );
    } catch (error) {
      console.error('RAGモデル処理エラー:', error);
      return {
        message:
          'RAGキーワード分類中にエラーが発生しました。しばらく時間をおいて再度お試しください。',
        error: error instanceof Error ? error.message : 'Unknown error',
        requiresSubscription: false,
      };
    }
  }

  /**
   * ユーザーメッセージからキーワードを抽出
   */
  private extractKeywordsFromUserMessage(userMessage: string): string[] {
    // 複数の形式に対応したキーワード抽出
    const patterns = [
      /キーワード[:：]\s*(.+)/i,
      /対象キーワード[:：]\s*(.+)/i,
      /分類[:：]\s*(.+)/i,
      /(.+)/, // フォールバック：全体をキーワードとして扱う
    ];

    for (const pattern of patterns) {
      const match = userMessage.match(pattern);
      if (match && match[1]) {
        return match[1]
          .split(/[,、\n]/)
          .map(k => k.trim())
          .filter(k => k.length > 0);
      }
    }

    return [];
  }
}
