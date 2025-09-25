import { cache } from 'react';
import { SupabaseService } from '@/server/services/supabaseService';
import {
  PromptTemplate,
  CreatePromptTemplateInput,
  UpdatePromptTemplateInput,
  PromptTemplateWithVersions,
} from '@/types/prompt';

/**
 * プロンプト管理サービス
 * React Cacheを活用した高速取得とバックグラウンド更新機能を提供
 */
export class PromptService extends SupabaseService {

  /**
   * 指定ユーザーの canonical_url 一覧を取得（重複排除・更新日時降順）
   */
  static async getCanonicalUrlsByUserId(userId: string): Promise<string[]> {
    return this.withServiceRoleClient(
      async client => {
        const { data, error } = await client
          .from('content_annotations')
          .select('canonical_url')
          .eq('user_id', userId)
          .not('canonical_url', 'is', null)
          .order('updated_at', { ascending: false });

        if (error) {
          throw error;
        }

        const urls = (data || [])
          .map((row: { canonical_url: string | null }) => row.canonical_url || '')
          .filter(u => typeof u === 'string' && u.trim().length > 0);

        return Array.from(new Set(urls));
      },
      {
        logMessage: 'canonical_url 取得処理エラー:',
        onError: () => [],
      }
    );
  }

  /**
   * ユーザー最新の content_annotations を1件取得
   */
  static async getLatestContentAnnotationByUserId(userId: string): Promise<{
    canonical_url: string | null;
    main_kw: string | null;
    kw: string | null;
    impressions: string | null;
    persona: string | null;
    needs: string | null;
    goal: string | null;
    prep: string | null;
    basic_structure: string | null;
    opening_proposal: string | null;
  } | null> {
    return this.withServiceRoleClient(
      async client => {
        const { data, error } = await client
          .from('content_annotations')
          .select(
            'canonical_url, main_kw, kw, impressions, persona, needs, goal, prep, basic_structure, opening_proposal'
          )
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          throw error;
        }

        return data || null;
      },
      {
        logMessage: 'content_annotations 取得処理エラー:',
        onError: () => null,
      }
    );
  }

  /**
   * 指定ユーザー・セッションに紐づく content_annotations を1件取得
   * 2025-09 のマイグレーションで session_id が導入されたため、チャット中はこれを優先使用
   */
  static async getContentAnnotationBySession(
    userId: string,
    sessionId: string
  ): Promise<{
    canonical_url: string | null;
    main_kw: string | null;
    kw: string | null;
    impressions: string | null;
    persona: string | null;
    needs: string | null;
    goal: string | null;
    prep: string | null;
    basic_structure: string | null;
    opening_proposal: string | null;
  } | null> {
    return this.withServiceRoleClient(
      async client => {
        const { data, error } = await client
          .from('content_annotations')
          .select(
            'canonical_url, main_kw, kw, impressions, persona, needs, goal, prep, basic_structure, opening_proposal'
          )
          .eq('user_id', userId)
          .eq('session_id', sessionId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        return data || null;
      },
      {
        logMessage: 'content_annotations (by session) 取得処理エラー:',
        onError: () => null,
      }
    );
  }

  /**
   * content_annotations からテンプレ置換用の変数レコードを作成
   * テンプレ側は {{contentPersona}} / {{contentNeeds}} / {{contentGoal}}
   * {{contentMainKw}} / {{contentKw}} / {{contentImpressions}} を使用可能
   */
  static buildContentVariables(
    annotation: {
      canonical_url: string | null;
      main_kw: string | null;
      kw: string | null;
      impressions: string | null;
      persona: string | null;
      needs: string | null;
      goal: string | null;
      prep: string | null;
      basic_structure: string | null;
      opening_proposal: string | null;
    } | null
  ): Record<string, string> {
    if (!annotation) return {};
    return {
      contentPersona: annotation.persona || '',
      contentNeeds: annotation.needs || '',
      contentGoal: annotation.goal || '',
      contentMainKw: annotation.main_kw || '',
      contentKw: annotation.kw || '',
      contentImpressions: annotation.impressions || '',
      contentPrep: annotation.prep || '',
      contentBasicStructure: annotation.basic_structure || '',
      contentOpeningProposal: annotation.opening_proposal || '',
    };
  }
  /**
   * プロンプトテンプレートを名前で取得（キャッシュ付き）
   */
  static getTemplateByName = cache(async (name: string): Promise<PromptTemplate | null> => {
    return PromptService.withServiceRoleClient(
      async client => {
        const { data, error } = await client
          .from('prompt_templates')
          .select('*')
          .eq('name', name)
          .eq('is_active', true)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw new Error(`プロンプト取得エラー: ${error.message}`);
        }

        return data || null;
      },
      {
        logMessage: 'プロンプト取得エラー:',
        onError: () => null,
      }
    );
  });

  /**
   * 全てのプロンプトテンプレートを取得
   */
  static async getAllTemplates(): Promise<PromptTemplate[]> {
    return this.withServiceRoleClient(
      async client => {
        const { data, error } = await client
          .from('prompt_templates')
          .select('*')
          .order('display_name', { ascending: true });

        if (error) {
          throw new Error(`プロンプト一覧取得エラー: ${error.message}`);
        }

        return data || [];
      },
      {
        logMessage: 'プロンプト一覧取得エラー:',
        onError: () => [],
      }
    );
  }

  /**
   * プロンプトテンプレートをIDで取得
   */
  static async getTemplateById(id: string): Promise<PromptTemplate | null> {
    return this.withServiceRoleClient(
      async client => {
        const { data, error } = await client
          .from('prompt_templates')
          .select('*')
          .eq('id', id)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw new Error(`プロンプト取得エラー: ${error.message}`);
        }

        return data || null;
      },
      {
        logMessage: 'プロンプトID取得エラー:',
        onError: () => null,
      }
    );
  }

  /**
   * プロンプトテンプレートとバージョン履歴を取得
   */
  static async getTemplateWithVersions(id: string): Promise<PromptTemplateWithVersions | null> {
    try {
      const template = await this.getTemplateById(id);
      if (!template) return null;

      const fallback = { ...template, versions: [] };

      return await this.withServiceRoleClient(
        async client => {
          const { data: versions, error } = await client
            .from('prompt_versions')
            .select('*')
            .eq('template_id', id)
            .order('version', { ascending: false });

          if (error) {
            throw error;
          }

          return {
            ...template,
            versions: versions || [],
          };
        },
        {
          logLevel: 'warn',
          logMessage: 'バージョン履歴取得エラー:',
          onError: () => fallback,
        }
      );
    } catch (error) {
      console.error('プロンプト詳細取得エラー:', error);
      return null;
    }
  }

  /**
   * 新しいプロンプトテンプレートを作成
   */
  static async createTemplate(data: CreatePromptTemplateInput): Promise<PromptTemplate> {
    const now = new Date().toISOString();

    const result = await this.withServiceRoleClient(
      async client => {
        const { data: inserted, error } = await client
          .from('prompt_templates')
          .insert({
            ...data,
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();

        if (error) {
          throw new Error(`プロンプト作成エラー: ${error.message}`);
        }

        return inserted;
      },
      {
        logMessage: 'プロンプト作成エラー:',
      }
    );

    // 初期バージョンを履歴に保存
    await this.saveVersion(result.id, data.content, 1, data.created_by, '初期作成');

    return result;
  }

  /**
   * プロンプトテンプレートを更新
   */
  static async updateTemplate(
    id: string,
    data: UpdatePromptTemplateInput
  ): Promise<PromptTemplate> {
    // 現在のバージョンを取得
    const current = await this.getTemplateById(id);
    if (!current) {
      throw new Error('プロンプトが見つかりません');
    }

    // 内容に変更がある場合のみバージョンを上げる
    const hasContentChange = data.content && data.content !== current.content;
    const newVersion = hasContentChange ? current.version + 1 : current.version;

    // バージョン履歴を保存（内容が変更された場合のみ）
    if (hasContentChange && data.content) {
      await this.saveVersion(
        id,
        current.content,
        current.version,
        data.updated_by,
        data.change_summary || '内容を更新'
      );
    }

    // メインテーブルを更新
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { change_summary, ...updateData } = data;
    return this.withServiceRoleClient(
      async client => {
        const { data: result, error } = await client
          .from('prompt_templates')
          .update({
            ...updateData,
            version: newVersion,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          throw new Error(`プロンプト更新エラー: ${error.message}`);
        }

        return result;
      },
      {
        logMessage: 'プロンプト更新エラー:',
      }
    );
  }

  /**
   * プロンプトテンプレートを削除（論理削除）
   */
  static async deleteTemplate(id: string, updatedBy: string): Promise<void> {
    await this.withServiceRoleClient(
      async client => {
        const { error } = await client
          .from('prompt_templates')
          .update({
            is_active: false,
            updated_by: updatedBy,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (error) {
          throw new Error(`プロンプト削除エラー: ${error.message}`);
        }
      },
      {
        logMessage: 'プロンプト削除エラー:',
      }
    );
  }

  /**
   * バージョン履歴を保存
   */
  private static async saveVersion(
    templateId: string,
    content: string,
    version: number,
    createdBy: string,
    changeSummary?: string
  ): Promise<void> {
    await this.withServiceRoleClient(
      async client => {
        const { error } = await client.from('prompt_versions').insert({
          template_id: templateId,
          version,
          content,
          change_summary: changeSummary,
          created_by: createdBy,
          created_at: new Date().toISOString(),
        });

        if (error) {
          throw new Error(`バージョン履歴保存エラー: ${error.message}`);
        }
      },
      {
        logMessage: 'バージョン履歴保存エラー:',
      }
    );
  }

  /**
   * 全ユーザーのプロンプトキャッシュを無効化
   */
  static async invalidateAllCaches(): Promise<void> {
    // React Cacheは自動で無効化される（Next.js 15の機能）
    // バックグラウンドで全ユーザーの事前生成プロンプトを再生成
    setImmediate(async () => {
      try {
        const service = new PromptService();
        const users = await service.getAllActiveUsers();
        const promises = users.map(user => service.regenerateUserPrompts(user.id));
        await Promise.allSettled(promises);
        console.log('プロンプトキャッシュ無効化完了');
      } catch (error) {
        console.error('キャッシュ無効化エラー:', error);
      }
    });
  }

  /**
   * アクティブなユーザー一覧を取得
   */
  private async getAllActiveUsers(): Promise<{ id: string; line_user_id: string }[]> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('id, line_user_id')
        .not('line_user_id', 'is', null);

      if (error) {
        throw new Error(`ユーザー一覧取得エラー: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('アクティブユーザー取得エラー:', error);
      return [];
    }
  }

  /**
   * ユーザーのプロンプトを再生成（将来の拡張用）
   */
  private async regenerateUserPrompts(userId: string): Promise<void> {
    try {
      // 将来的にユーザー固有のプロンプトキャッシュを再生成する処理を実装
      console.log(`ユーザー ${userId} のプロンプト再生成を開始`);
      // ユーザー固有プロンプトキャッシュ機能は未実装
    } catch (error) {
      console.error(`ユーザー ${userId} のプロンプト再生成エラー:`, error);
    }
  }

  /**
   * プロンプト変数を置換
   */
  static replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;

    // 置換状況を追跡
    const replacedKeys: string[] = [];

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      if (regex.test(result)) {
        replacedKeys.push(key);
      }
      result = result.replace(regex, value || '');
    }

    // 置換後に残っているプレースホルダも確認
    const unresolved = (result.match(/{{(\w+)}}/g) || []).map(v => v.replace(/[{}]/g, ''));

    // デバッグログ
    console.log('[PromptService.replaceVariables] 変数置換', {
      replaced: replacedKeys,
      unresolved,
    });

    return result;
  }

  /**
   * プロンプトテンプレートの検証
   */
  static validateTemplate(template: PromptTemplate): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!template.name || template.name.trim().length === 0) {
      errors.push('プロンプト名は必須です');
    }

    if (!template.display_name || template.display_name.trim().length === 0) {
      errors.push('表示名は必須です');
    }

    if (!template.content || template.content.trim().length === 0) {
      errors.push('プロンプト内容は必須です');
    }

    // 変数の整合性チェック
    if (template.variables && template.variables.length > 0) {
      const contentVariables = template.content.match(/{{(\w+)}}/g) || [];
      const definedVariables = template.variables.map(v => `{{${v.name}}}`);

      const undefinedVariables = contentVariables.filter(v => !definedVariables.includes(v));
      if (undefinedVariables.length > 0) {
        errors.push(`未定義の変数があります: ${undefinedVariables.join(', ')}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
