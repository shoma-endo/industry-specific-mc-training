"use server"

import { userService } from '@/server/services/userService';
import { cookies } from 'next/headers';
import {
  isViewModeEnabled,
  resolveViewModeRole,
  VIEW_MODE_ERROR_MESSAGE,
} from '@/server/lib/view-mode';
import { authMiddleware } from '@/server/middleware/auth.middleware';

export const updateUserFullName = async (fullName: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const cookieStore = await cookies();
    const lineAccessToken = cookieStore.get('line_access_token')?.value;
    const refreshToken = cookieStore.get('line_refresh_token')?.value;

    if (!lineAccessToken) {
      return { success: false, error: 'ログインしていません' };
    }

    const authResult = await authMiddleware(lineAccessToken, refreshToken, {
      skipSubscriptionCheck: true
    });
    if (authResult.error) {
      return { success: false, error: authResult.error };
    }

    if (await isViewModeEnabled(resolveViewModeRole(authResult))) {
      return { success: false, error: VIEW_MODE_ERROR_MESSAGE };
    }

    if (!authResult.userId) {
      return { success: false, error: 'ユーザーが見つかりません' };
    }

    const success = await userService.updateFullName(authResult.userId, fullName);
    if (!success) {
      return { success: false, error: 'フルネームの更新に失敗しました' };
    }

    return { success: true };
  } catch (error) {
    console.error('フルネーム更新エラー:', error);
    return { success: false, error: 'フルネームの更新中にエラーが発生しました' };
  }
};
