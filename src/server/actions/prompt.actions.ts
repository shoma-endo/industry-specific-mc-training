'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { PromptService } from '@/server/services/promptService';
import { isUnavailable } from '@/authUtils';
import {
  CreatePromptTemplateInput,
  UpdatePromptTemplateInput,
  PromptTemplate,
  PromptTemplateWithVersions,
} from '@/types/prompt';
import { isViewModeEnabled, VIEW_MODE_ERROR_MESSAGE } from '@/server/lib/view-mode';
import { isValidUserRole } from '@/types/user';

const promptVariableSchema = z.object({
  name: z.string().min(1, '変数名は必須です'),
  description: z.string().min(1, '変数説明は必須です'),
});

const promptSchema = z.object({
  name: z
    .string()
    .min(1, 'プロンプト名は必須です')
    .max(255, 'プロンプト名は255文字以内で入力してください'),
  display_name: z
    .string()
    .min(1, '表示名は必須です')
    .max(255, '表示名は255文字以内で入力してください'),
  content: z.string().min(1, 'プロンプト内容は必須です'),
  variables: z.array(promptVariableSchema).default([]),
});

type PromptActionResponse<T = unknown> = T extends void
  ? { success: true; error?: undefined } | { success: false; error: string }
  :
      | { success: true; data: T; error?: undefined }
      | { success: false; data?: undefined; error: string };

/**
 * 管理者権限をチェックするヘルパー関数
 */
async function checkAdminPermission(liffAccessToken: string) {
  const auth = await authMiddleware(liffAccessToken);

  if (auth.error) {
    return { success: false, error: auth.error || '認証エラーが発生しました' };
  }

  // 管理者権限チェック（roleがadminかどうか）
  try {
    const service = new PromptService();
    const userResult = await service.getUserByLineId(auth.lineUserId);
    if (!userResult.success) {
      return { success: false, error: userResult.error.userMessage };
    }

    const user = userResult.data;
    if (!user) {
      return { success: false, error: 'ユーザー情報が見つかりません' };
    }

    // ロールの実行時検証
    if (!isValidUserRole(user.role)) {
      return { success: false, error: 'ユーザーロールが不正です' };
    }

    // unavailableユーザーのサービス利用制限チェック
    if (isUnavailable(user.role)) {
      return { success: false, error: 'サービスの利用が停止されています' };
    }

    if (user.role !== 'admin') {
      return { success: false, error: '管理者権限が必要です' };
    }

    return { success: true, userId: auth.userId, user };
  } catch (error) {
    console.error('管理者権限チェックエラー:', error);
    return { success: false, error: '権限確認中にエラーが発生しました' };
  }
}

/**
 * プロンプトテンプレートを作成
 */
export async function createPromptTemplate(
  liffAccessToken: string,
  data: z.infer<typeof promptSchema>
): Promise<PromptActionResponse<PromptTemplate>> {
  try {
    // 管理者権限チェック
    const adminCheck = await checkAdminPermission(liffAccessToken);
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error || '権限チェックに失敗しました' };
    }
    const adminUser = adminCheck.user;
    if (!adminUser) {
      return { success: false, error: 'ユーザー情報が見つかりません' };
    }
    if (await isViewModeEnabled(adminUser.role)) {
      return { success: false, error: VIEW_MODE_ERROR_MESSAGE };
    }

    // データ検証
    const validatedData = promptSchema.parse(data);

    // 重複チェック
    const existingTemplate = await PromptService.getTemplateByName(validatedData.name);
    if (existingTemplate) {
      return { success: false, error: '同じ名前のプロンプトが既に存在します' };
    }

    // テンプレート作成
    const createInput: CreatePromptTemplateInput = {
      ...validatedData,
      created_by: adminCheck.userId!,
    };

    const result = await PromptService.createTemplate(createInput);

    // キャッシュ無効化
    revalidatePath('/admin/prompts');

    return { success: true, data: result };
  } catch (error) {
    console.error('プロンプト作成エラー:', error);
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `入力データが不正です: ${error.issues.map(e => e.message).join(', ')}`,
      };
    }
    return { success: false, error: 'プロンプトの作成に失敗しました' };
  }
}

/**
 * プロンプトテンプレートを更新
 */
export async function updatePromptTemplate(
  liffAccessToken: string,
  id: string,
  data: z.infer<typeof promptSchema>
): Promise<PromptActionResponse<PromptTemplate>> {
  try {
    // 管理者権限チェック
    const adminCheck = await checkAdminPermission(liffAccessToken);
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error || '権限チェックに失敗しました' };
    }
    const adminUser = adminCheck.user;
    if (!adminUser) {
      return { success: false, error: 'ユーザー情報が見つかりません' };
    }
    if (await isViewModeEnabled(adminUser.role)) {
      return { success: false, error: VIEW_MODE_ERROR_MESSAGE };
    }

    // データ検証
    const validatedData = promptSchema.parse(data);

    // 存在チェック
    const existingTemplate = await PromptService.getTemplateById(id);
    if (!existingTemplate) {
      return { success: false, error: 'プロンプトが見つかりません' };
    }

    // 名前の重複チェック（自分以外）
    if (validatedData.name !== existingTemplate.name) {
      const duplicateTemplate = await PromptService.getTemplateByName(validatedData.name);
      if (duplicateTemplate && duplicateTemplate.id !== id) {
        return { success: false, error: '同じ名前のプロンプトが既に存在します' };
      }
    }

    // テンプレート更新
    const updateInput: UpdatePromptTemplateInput = {
      ...validatedData,
      updated_by: adminCheck.userId!,
    };

    const result = await PromptService.updateTemplate(id, updateInput);

    // 全プロンプトキャッシュを無効化（即座反映）
    await PromptService.invalidateAllCaches();

    // 画面を再検証
    revalidatePath('/admin/prompts');
    revalidatePath(`/admin/prompts/${id}`);

    return { success: true, data: result };
  } catch (error) {
    console.error('プロンプト更新エラー:', error);
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `入力データが不正です: ${error.issues.map(e => e.message).join(', ')}`,
      };
    }
    return { success: false, error: 'プロンプトの更新に失敗しました' };
  }
}

/**
 * プロンプトテンプレート一覧を取得
 */
export async function getPromptTemplates(
  liffAccessToken: string
): Promise<PromptActionResponse<PromptTemplate[]>> {
  try {
    // 管理者権限チェック
    const adminCheck = await checkAdminPermission(liffAccessToken);
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error || '権限チェックに失敗しました' };
    }

    const templates = await PromptService.getAllTemplates();
    return { success: true, data: templates };
  } catch (error) {
    console.error('プロンプト取得エラー:', error);
    return { success: false, error: 'プロンプトの取得に失敗しました' };
  }
}

/**
 * プロンプトテンプレートを詳細取得（バージョン履歴付き）
 */
export async function getPromptTemplate(
  liffAccessToken: string,
  id: string
): Promise<PromptActionResponse<PromptTemplateWithVersions>> {
  try {
    // 管理者権限チェック
    const adminCheck = await checkAdminPermission(liffAccessToken);
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error || '権限チェックに失敗しました' };
    }

    const template = await PromptService.getTemplateWithVersions(id);
    if (!template) {
      return { success: false, error: 'プロンプトが見つかりません' };
    }

    return { success: true, data: template };
  } catch (error) {
    console.error('プロンプト詳細取得エラー:', error);
    return { success: false, error: 'プロンプトの取得に失敗しました' };
  }
}

/**
 * プロンプトテンプレートの検証
 */
export async function validatePromptTemplate(
  liffAccessToken: string,
  data: z.infer<typeof promptSchema>
): Promise<PromptActionResponse<{ isValid: boolean; errors: string[] }>> {
  try {
    // 管理者権限チェック
    const adminCheck = await checkAdminPermission(liffAccessToken);
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error || '権限チェックに失敗しました' };
    }

    // データ検証
    const validatedData = promptSchema.parse(data);

    // 仮のプロンプトテンプレートオブジェクトを作成して検証
    const tempTemplate: PromptTemplate = {
      id: 'temp',
      name: validatedData.name,
      display_name: validatedData.display_name,
      content: validatedData.content,
      variables: validatedData.variables,
      version: 1,
      created_by: adminCheck.userId!,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const validation = PromptService.validateTemplate(tempTemplate);

    return { success: true, data: validation };
  } catch (error) {
    console.error('プロンプト検証エラー:', error);
    if (error instanceof z.ZodError) {
      return {
        success: true,
        data: {
          isValid: false,
          errors: error.issues.map(e => e.message),
        },
      };
    }
    return { success: false, error: 'プロンプトの検証に失敗しました' };
  }
}
