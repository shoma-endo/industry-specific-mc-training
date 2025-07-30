"use server"

import { userService } from '@/server/services/userService';
import { cookies } from 'next/headers';
import { checkUserRole } from './subscription.actions';
import type { User } from '@/types/user';

export const getAllUsers = async (): Promise<{ success: boolean; users?: User[]; error?: string }> => {
  try {
    const cookieStore = await cookies();
    const lineAccessToken = cookieStore.get('line_access_token')?.value;

    if (!lineAccessToken) {
      return { success: false, error: 'ログインしていません' };
    }

    // 管理者権限チェック
    const roleResult = await checkUserRole(lineAccessToken);
    if (!roleResult.success || roleResult.role !== 'admin') {
      return { success: false, error: '管理者権限が必要です' };
    }

    const users = await userService.getAllUsers();
    return { success: true, users };
  } catch (error) {
    console.error('ユーザー一覧取得エラー:', error);
    return { success: false, error: 'ユーザー一覧の取得中にエラーが発生しました' };
  }
};