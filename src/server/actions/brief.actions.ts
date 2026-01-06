'use server';

import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';
import { briefInputSchema, type BriefInput } from '@/server/schemas/brief.schema';
import { cookies } from 'next/headers';
import type { ZodIssue } from 'zod';
import { isOwner } from '@/authUtils';
import { ERROR_MESSAGES } from '@/domain/errors/error-messages';
import { getLiffTokensFromCookies } from '@/server/lib/auth-helpers';

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
      return { success: false, error: ERROR_MESSAGES.BRIEF.INPUT_ERROR(fieldErrors) };
    }

    // 認証
    const auth = await authMiddleware(liffAccessToken);
    if (auth.error || !auth.userId) {
      return { success: false, error: auth.error || ERROR_MESSAGES.AUTH.AUTH_ERROR_GENERIC };
    }
    if (auth.viewMode) {
      return { success: false, error: ERROR_MESSAGES.USER.VIEW_MODE_OPERATION_NOT_ALLOWED };
    }
    if (isOwner(auth.userDetails?.role ?? null)) {
      return { success: false, error: ERROR_MESSAGES.USER.VIEW_MODE_NOT_ALLOWED };
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
      error: error instanceof Error ? error.message : ERROR_MESSAGES.BRIEF.SAVE_FAILED,
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
    const cookieStore = await cookies();
    const isViewMode = cookieStore.get('owner_view_mode')?.value === '1';
    // 認証
    const auth = await authMiddleware(liffAccessToken);
    if (auth.error || !auth.userId) {
      return { success: false, error: auth.error || ERROR_MESSAGES.AUTH.AUTH_ERROR_GENERIC };
    }
    if (isOwner(auth.userDetails?.role ?? null) && !isViewMode) {
      return { success: false, error: ERROR_MESSAGES.USER.VIEW_MODE_NOT_ALLOWED };
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
      error: error instanceof Error ? error.message : ERROR_MESSAGES.BRIEF.FETCH_FAILED,
    };
  }
};

/**
 * Server Component用：事業者情報を取得
 * Cookie認証の制約により、認証チェックのみ実行
 */
export const getBriefServer = async (): Promise<ActionResult<BriefInput | null>> => {
  try {
    const { accessToken } = await getLiffTokensFromCookies();

    if (!accessToken) {
      return { success: false, error: ERROR_MESSAGES.BRIEF.LOGIN_REQUIRED };
    }

    // 実際のデータ取得はClient Componentで実行
    return { success: true, data: null };
  } catch (error) {
    console.error('事業者情報の取得エラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : ERROR_MESSAGES.BRIEF.FETCH_FAILED,
    };
  }
};
