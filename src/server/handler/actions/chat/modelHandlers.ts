import { chatService } from '@/server/services/chatService';
import { openAiService } from '@/server/services/openAiService';
import { ChatProcessorService } from './chatProcessors';
import { MODEL_CONFIGS } from '@/lib/constants';
import { getSystemPrompt as getSystemPromptShared } from '@/lib/prompts';
import { ChatResponse } from '@/types/chat';
import type { StartChatInput, ContinueChatInput } from '../chat.actions';
import { PromptRetrievalService } from '@/server/services/promptRetrievalService';
import { BriefService } from '@/server/services/briefService';
import { PromptService } from '@/services/promptService';

/**
 * モデルに応じた動的プロンプト取得（React Cache活用）
 */
const getSystemPrompt = getSystemPromptShared;

export class ModelHandlerService {
  private processor = new ChatProcessorService();

  async handleStart(userId: string, data: StartChatInput): Promise<ChatResponse> {
    const { userMessage, model, liffAccessToken } = data;
    // キャッシュ戦略を活用した動的プロンプト取得
    const systemPrompt = await getSystemPrompt(model, liffAccessToken);

    switch (model) {
      case 'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2':
        return this.handleFTModel(userId, systemPrompt, userMessage, model);
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
        // ユーザー入力 + AI応答を分離して保存
        return await chatService.continueChat(
          userId,
          sessionId,
          [userMessage.trim(), result.message],
          systemPrompt,
          [],
          model
        );
      }

      const assistantReply = `【今すぐ客キーワード】\n${immediate.join('\n')}\n\n【後から客キーワード】\n${later.join('\n')}`;
      return await chatService.continueChat(
        userId,
        sessionId,
        [userMessage.trim(), assistantReply],
        systemPrompt,
        [],
        model
      );
    } else if (
      model === 'ad_copy_creation' ||
      model === 'ad_copy_finishing' ||
      model === 'lp_improvement'
    ) {
      // ✅ Claudeモデルの履歴引き継ぎ対応
      const validMessages = messages.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));

      return await chatService.continueChat(
        userId,
        sessionId,
        userMessage,
        systemPrompt,
        validMessages, // 履歴を正しく渡す
        model
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
    }

    // デフォルト処理: 未対応モデルの場合
    const validMessages = messages.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
    }));

    return await chatService.continueChat(
      userId,
      sessionId,
      userMessage,
      systemPrompt,
      validMessages,
      model
    );
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
      // ユーザー入力はそのまま、AI応答として分類結果のみを返す
      return await chatService.startChat(
        userId,
        systemPrompt,
        [userMessage.trim(), result.message],
        model
      );
    }

    // ユーザー入力はそのまま、AI応答として分類結果を返す
    const assistantReply = `【今すぐ客キーワード】\n${immediate.join('\n')}\n\n【後から客キーワード】\n${later.join('\n')}`;
    return await chatService.startChat(
      userId,
      systemPrompt,
      [userMessage.trim(), assistantReply],
      model
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
      // 論理キー "lp_draft_creation" を渡すことで maxTokens=20000 が適用される
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

  /**
   * RAGモデルの処理（新機能）
   */
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
