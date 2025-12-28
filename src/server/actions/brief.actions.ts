'use server';

import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';
import { briefInputSchema, type BriefInput } from '@/server/schemas/brief.schema';
import { cookies } from 'next/headers';
import type { ZodIssue } from 'zod';
import { isOwner } from '@/authUtils';

const supabaseService = new SupabaseService();

export type ActionResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * 事業者情報を保存するServer Action
 */
export const saveBrief = async (
  payload: BriefInput & { liffAccessToken: string }
): Promise<ActionResult<null>> => {
  try {
    const { liffAccessToken, ...formData } = payload;

    // バリデーション
    const validationResult = briefInputSchema.safeParse(formData);
    if (!validationResult.success) {
      const fieldErrors = validationResult.error.issues
        .map((issue: ZodIssue) => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ');
      return { success: false, error: `入力エラー: ${fieldErrors}` };
    }

    // 認証
    const auth = await authMiddleware(liffAccessToken);
    if (auth.error || !auth.userId) {
      return { success: false, error: auth.error || '認証エラー' };
    }
    if (isOwner(auth.userDetails?.role ?? null)) {
      return { success: false, error: '閲覧権限では利用できません' };
    }

    // 事業者情報を保存
    const saveResult = await supabaseService.saveBrief(auth.userId, validationResult.data);

    if (!saveResult.success) {
      return { success: false, error: saveResult.error.userMessage };
    }

    return { success: true };
  } catch (error) {
    console.error('事業者情報の保存エラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '事業者情報の保存に失敗しました',
    };
  }
};

/**
 * 事業者情報を取得するServer Action
 */
export const getBrief = async (
  liffAccessToken: string
): Promise<ActionResult<BriefInput | null>> => {
  try {
    // 認証
    const auth = await authMiddleware(liffAccessToken);
    if (auth.error || !auth.userId) {
      return { success: false, error: auth.error || '認証エラー' };
    }
    if (isOwner(auth.userDetails?.role ?? null)) {
      return { success: false, error: '閲覧権限では利用できません' };
    }

    // 事業者情報を取得
    const briefResult = await supabaseService.getBrief(auth.userId);

    if (!briefResult.success) {
      return { success: false, error: briefResult.error.userMessage };
    }

    return { success: true, data: briefResult.data as BriefInput | null };
  } catch (error) {
    console.error('事業者情報の取得エラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '事業者情報の取得に失敗しました',
    };
  }
};

/**
 * Server Component用：事業者情報を取得
 * Cookie認証の制約により、認証チェックのみ実行
 */
export const getBriefServer = async (): Promise<ActionResult<BriefInput | null>> => {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('line_access_token')?.value;

    if (!accessToken) {
      return { success: false, error: 'ログインが必要です' };
    }

    // 実際のデータ取得はClient Componentで実行
    return { success: true, data: null };
  } catch (error) {
    console.error('事業者情報の取得エラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '事業者情報の取得に失敗しました',
    };
  }
};
