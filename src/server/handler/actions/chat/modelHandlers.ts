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
} from '@/lib/prompts';
import { ChatResponse } from '@/types/chat';
import type { StartChatInput, ContinueChatInput } from '../shared/validators';
import { RAGKeywordClassifier } from '@/lib/rag-keyword-classifier';

const SYSTEM_PROMPTS: Record<string, string> = {
  'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2': KEYWORD_CATEGORIZATION_PROMPT,
  'rag_keyword_classifier': KEYWORD_CATEGORIZATION_PROMPT,
  ad_copy_creation: AD_COPY_PROMPT,
  'gpt-4.1-nano-2025-04-14': AD_COPY_FINISHING_PROMPT,
  lp_draft_creation: LP_DRAFT_PROMPT,
};

export class ModelHandlerService {
  private processor = new ChatProcessorService();
  private ragClassifier = new RAGKeywordClassifier();

  async handleStart(userId: string, data: StartChatInput): Promise<ChatResponse> {
    const { userMessage, model, liffAccessToken } = data;
    const systemPrompt = SYSTEM_PROMPTS[model] ?? SYSTEM_PROMPT;

    switch (model) {
      case 'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2':
        return this.handleFTModel(userId, systemPrompt, userMessage, model, liffAccessToken);
      case 'rag_keyword_classifier':
        return this.handleRAGModel(userId, systemPrompt, userMessage, liffAccessToken);
      case 'semrush_search':
        return this.handleSemrushModel(userId, systemPrompt, userMessage);
      case 'ad_copy_creation':
        return this.handleAdCopyModel(userId, systemPrompt, userMessage);
      case 'gpt-4.1-nano-2025-04-14':
        return this.handleFinishingModel(userId, systemPrompt, userMessage);
      case 'lp_draft_creation':
        return this.handleLPDraftModel(userId, systemPrompt, userMessage);
      default:
        return this.handleDefaultModel(userId, systemPrompt, userMessage, model);
    }
  }

  async handleContinue(userId: string, data: ContinueChatInput): Promise<ChatResponse> {
    const { sessionId, messages, userMessage, model, liffAccessToken } = data;
    const systemPrompt = SYSTEM_PROMPTS[model] ?? SYSTEM_PROMPT;

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

      const getSearchResults = await this.processor.handleGoogleSearch(immediate, liffAccessToken);
      const aiResponses = await this.processor.generateAIResponsesFromTitles(getSearchResults);
      const falseQueries = this.extractFalseQueries(aiResponses);
      const afterKeywords = this.subtractMultilineStrings(immediate.join('\n'), falseQueries);

      return await chatService.continueChat(
        userId,
        sessionId,
        `【今すぐ客キーワード】\n${afterKeywords.remaining}\n\n【後から客キーワード】\n${afterKeywords.removed}${later.join('\n')}`,
        systemPrompt,
        [],
        model
      );
    } else if (model === 'rag_keyword_classifier') {
      // RAGシステムでの分類処理
      const keywords = this.extractKeywordsFromUserMessage(userMessage);
      const result = await this.ragClassifier.classifyKeywords(keywords, { includeEvidence: false });
      
      const immediate = result.results.immediate_customer.map(k => k.keyword);
      const later = result.results.later_customer.map(k => k.keyword);

      if (immediate.length === 0) {
        const responseMessage = `【今すぐ客キーワード】\n（該当なし）\n\n【後から客キーワード】\n${later.join('\n')}`;
        return await chatService.continueChat(userId, sessionId, responseMessage, systemPrompt, [], model);
      }

      const getSearchResults = await this.processor.handleGoogleSearch(immediate, liffAccessToken);
      const aiResponses = await this.processor.generateAIResponsesFromTitles(getSearchResults);
      const falseQueries = this.extractFalseQueries(aiResponses);
      const afterKeywords = this.subtractMultilineStrings(immediate.join('\n'), falseQueries);

      return await chatService.continueChat(
        userId,
        sessionId,
        `【今すぐ客キーワード】\n${afterKeywords.remaining}\n\n【後から客キーワード】\n${afterKeywords.removed}${later.join('\n')}`,
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

      const adItems = this.processor.parseAdItems(searchResult.replace(/^ドメイン：.*\r?\n?/gm, ''));
      return await chatService.continueChat(
        userId,
        sessionId,
        JSON.stringify(adItems),
        systemPrompt,
        [],
        'gpt-4.1-nano-2025-04-14',
        userMessage.trim(),
        searchResult
      );
    } else {
      return await chatService.continueChat(userId, sessionId, userMessage, systemPrompt, [], model);
    }
  }

  private async handleFTModel(
    userId: string,
    systemPrompt: string,
    userMessage: string,
    model: string,
    liffAccessToken: string
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

    const getSearchResults = await this.processor.handleGoogleSearch(immediate, liffAccessToken);
    const aiResponses = await this.processor.generateAIResponsesFromTitles(getSearchResults);
    const falseQueries = this.extractFalseQueries(aiResponses);
    const afterKeywords = this.subtractMultilineStrings(immediate.join('\n'), falseQueries);

    return await chatService.startChat(
      userId, 
      systemPrompt, 
      `${userMessage}\n\n【今すぐ客キーワード】\n${afterKeywords.remaining}\n\n【後から客キーワード】\n${afterKeywords.removed}${later.join('\n')}`
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
      'gpt-4.1-nano-2025-04-14',
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
      'gpt-4.1-nano-2025-04-14'
    );
  }

  private async handleFinishingModel(
    userId: string,
    systemPrompt: string,
    userMessage: string
  ): Promise<ChatResponse> {
    return await chatService.startChat(
      userId,
      systemPrompt,
      userMessage.trim(),
      'gpt-4.1-nano-2025-04-14'
    );
  }

  private async handleLPDraftModel(
    userId: string,
    systemPrompt: string,
    userMessage: string
  ): Promise<ChatResponse> {
    return await chatService.startChat(
      userId,
      systemPrompt,
      userMessage.trim(),
      'gpt-4.1-nano-2025-04-14'
    );
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

  private extractFalseQueries(aiResponses: { query: string; aiMessage: string }[]): string[] {
    return aiResponses
      .filter(response => {
        const message = response.aiMessage.toLowerCase().trim();
        return message === 'false' || message === 'no' || message === 'x' || message === '×';
      })
      .map(response => response.query);
  }

  private subtractMultilineStrings(original: string, toRemove: string[]) {
    const originalLines = original.split('\n').map(line => line.trim()).filter(line => line);
    const toRemoveSet = new Set(toRemove.map(item => item.trim()));

    const remaining: string[] = [];
    const removed: string[] = [];

    originalLines.forEach(line => {
      if (toRemoveSet.has(line)) {
        removed.push(line);
      } else {
        remaining.push(line);
      }
    });

    return {
      remaining: remaining.join('\n'),
      removed: removed.length > 0 ? removed.join('\n') + '\n' : '',
    };
  }

  /**
   * RAGモデルの処理（新機能）
   */
  private async handleRAGModel(
    userId: string,
    systemPrompt: string,
    userMessage: string,
    liffAccessToken: string
  ): Promise<ChatResponse> {
    try {
      // ユーザーメッセージからキーワードを抽出
      const keywords = this.extractKeywordsFromUserMessage(userMessage);
      
      if (keywords.length === 0) {
        return { 
          message: 'キーワードが見つかりませんでした。分類するキーワードを入力してください。', 
          error: '', 
          requiresSubscription: false 
        };
      }

      // RAGシステムで分類実行
      const result = await this.ragClassifier.classifyKeywords(keywords, { 
        includeEvidence: false 
      });

      const immediate = result.results.immediate_customer.map(k => k.keyword);
      const later = result.results.later_customer.map(k => k.keyword);

      if (immediate.length === 0) {
        const responseMessage = `【今すぐ客キーワード】\n（該当なし）\n\n【後から客キーワード】\n${later.join('\n')}`;
        return await chatService.startChat(userId, systemPrompt, responseMessage);
      }

      // Google検索による検証（既存の処理と同様）
      const getSearchResults = await this.processor.handleGoogleSearch(immediate, liffAccessToken);
      const aiResponses = await this.processor.generateAIResponsesFromTitles(getSearchResults);
      const falseQueries = this.extractFalseQueries(aiResponses);
      const afterKeywords = this.subtractMultilineStrings(immediate.join('\n'), falseQueries);

      return await chatService.startChat(
        userId, 
        systemPrompt, 
        `${userMessage}\n\n【今すぐ客キーワード】\n${afterKeywords.remaining}\n\n【後から客キーワード】\n${afterKeywords.removed}${later.join('\n')}`
      );

    } catch (error) {
      console.error('RAGモデル処理エラー:', error);
      return { 
        message: 'RAGキーワード分類中にエラーが発生しました。しばらく時間をおいて再度お試しください。', 
        error: error instanceof Error ? error.message : 'Unknown error', 
        requiresSubscription: false 
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