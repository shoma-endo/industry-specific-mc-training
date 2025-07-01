import { cache } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '@/server/services/supabaseService';
import { SupabaseClientManager } from '@/lib/supabase/client-manager';
import { 
  PromptTemplate, 
  CreatePromptTemplateInput, 
  UpdatePromptTemplateInput,
  PromptTemplateWithVersions 
} from '@/types/prompt';

/**
 * プロンプト管理サービス
 * React Cacheを活用した高速取得とバックグラウンド更新機能を提供
 */
export class PromptService extends SupabaseService {
  // サービスロール用のクライアントを追加
  protected readonly serviceRoleSupabase: SupabaseClient;

  constructor() {
    super();
    // 管理者機能ではサービスロールクライアントを使用
    this.serviceRoleSupabase = SupabaseClientManager.getInstance().getServiceRoleClient();
  }
  /**
   * プロンプトテンプレートを名前で取得（キャッシュ付き）
   */
  static getTemplateByName = cache(async (name: string): Promise<PromptTemplate | null> => {
    try {
      const service = new PromptService();
      const { data, error } = await service.supabase
        .from('prompt_templates')
        .select('*')
        .eq('name', name)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`プロンプト取得エラー: ${error.message}`);
      }

      return data || null;
    } catch (error) {
      console.error('プロンプト取得エラー:', error);
      return null;
    }
  });

  /**
   * 全てのプロンプトテンプレートを取得
   */
  static async getAllTemplates(): Promise<PromptTemplate[]> {
    try {
      const service = new PromptService();
      // サービスロールクライアントを使用してRLSをバイパス
      const { data, error } = await service.serviceRoleSupabase
        .from('prompt_templates')
        .select('*')
        .order('display_name', { ascending: true });

      if (error) {
        throw new Error(`プロンプト一覧取得エラー: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('プロンプト一覧取得エラー:', error);
      return [];
    }
  }

  /**
   * プロンプトテンプレートをIDで取得
   */
  static async getTemplateById(id: string): Promise<PromptTemplate | null> {
    try {
      const service = new PromptService();
      const { data, error } = await service.serviceRoleSupabase
        .from('prompt_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`プロンプト取得エラー: ${error.message}`);
      }

      return data || null;
    } catch (error) {
      console.error('プロンプトID取得エラー:', error);
      return null;
    }
  }

  /**
   * プロンプトテンプレートとバージョン履歴を取得
   */
  static async getTemplateWithVersions(id: string): Promise<PromptTemplateWithVersions | null> {
    try {
      const service = new PromptService();
      
      // メインテンプレートを取得
      const template = await this.getTemplateById(id);
      if (!template) return null;

      // バージョン履歴を取得
      const { data: versions, error } = await service.serviceRoleSupabase
        .from('prompt_versions')
        .select('*')
        .eq('template_id', id)
        .order('version', { ascending: false });

      if (error) {
        console.warn('バージョン履歴取得エラー:', error);
        return { ...template, versions: [] };
      }

      return {
        ...template,
        versions: versions || []
      };
    } catch (error) {
      console.error('プロンプト詳細取得エラー:', error);
      return null;
    }
  }

  /**
   * 新しいプロンプトテンプレートを作成
   */
  static async createTemplate(data: CreatePromptTemplateInput): Promise<PromptTemplate> {
    try {
      const service = new PromptService();
      const now = new Date().toISOString();
      
      const { data: result, error } = await service.serviceRoleSupabase
        .from('prompt_templates')
        .insert({
          ...data,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (error) {
        throw new Error(`プロンプト作成エラー: ${error.message}`);
      }

      // 初期バージョンを履歴に保存
      await this.saveVersion(result.id, data.content, 1, data.created_by, '初期作成');

      return result;
    } catch (error) {
      console.error('プロンプト作成エラー:', error);
      throw error;
    }
  }

  /**
   * プロンプトテンプレートを更新
   */
  static async updateTemplate(
    id: string, 
    data: UpdatePromptTemplateInput
  ): Promise<PromptTemplate> {
    try {
      const service = new PromptService();
      
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
      const { data: result, error } = await service.serviceRoleSupabase
        .from('prompt_templates')
        .update({
          ...updateData,
          version: newVersion,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`プロンプト更新エラー: ${error.message}`);
      }

      return result;
    } catch (error) {
      console.error('プロンプト更新エラー:', error);
      throw error;
    }
  }

  /**
   * プロンプトテンプレートを削除（論理削除）
   */
  static async deleteTemplate(id: string, updatedBy: string): Promise<void> {
    try {
      const service = new PromptService();
      
      const { error } = await service.serviceRoleSupabase
        .from('prompt_templates')
        .update({
          is_active: false,
          updated_by: updatedBy,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        throw new Error(`プロンプト削除エラー: ${error.message}`);
      }
    } catch (error) {
      console.error('プロンプト削除エラー:', error);
      throw error;
    }
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
    try {
      const service = new PromptService();
      
      const { error } = await service.serviceRoleSupabase
        .from('prompt_versions')
        .insert({
          template_id: templateId,
          version,
          content,
          change_summary: changeSummary,
          created_by: createdBy,
          created_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(`バージョン履歴保存エラー: ${error.message}`);
      }
    } catch (error) {
      console.error('バージョン履歴保存エラー:', error);
      throw error;
    }
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
        const promises = users.map(user => 
          service.regenerateUserPrompts(user.id)
        );
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
      // TODO: 実装予定
    } catch (error) {
      console.error(`ユーザー ${userId} のプロンプト再生成エラー:`, error);
    }
  }

  /**
   * プロンプト変数を置換
   */
  static replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value || '');
    }
    
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
      errors
    };
  }
}