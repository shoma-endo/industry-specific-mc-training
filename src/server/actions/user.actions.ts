"use server"

import { userService } from '@/server/services/userService';
import { cookies } from 'next/headers';

export const updateUserFullName = async (fullName: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const cookieStore = await cookies();
    const lineAccessToken = cookieStore.get('line_access_token')?.value;
    const isViewMode = cookieStore.get('owner_view_mode')?.value === '1';

    if (!lineAccessToken) {
      return { success: false, error: 'ログインしていません' };
    }
    if (isViewMode) {
      return { success: false, error: '閲覧モードでは操作できません' };
    }

    const user = await userService.getUserFromLiffToken(lineAccessToken);
    if (!user) {
      return { success: false, error: 'ユーザーが見つかりません' };
    }

    const success = await userService.updateFullName(user.id, fullName);
    if (!success) {
      return { success: false, error: 'フルネームの更新に失敗しました' };
    }

    return { success: true };
  } catch (error) {
    console.error('フルネーム更新エラー:', error);
    return { success: false, error: 'フルネームの更新中にエラーが発生しました' };
  }
};
