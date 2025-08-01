"use server"

import { userService } from '@/server/services/userService';
import { cookies } from 'next/headers';
import { checkUserRole } from './subscription.actions';
import { canUseServices } from '@/lib/auth-utils';
import type { User, UserRole } from '@/types/user';

export const getAllUsers = async (): Promise<{ success: boolean; users?: User[]; error?: string }> => {
  try {
    const cookieStore = await cookies();
    const lineAccessToken = cookieStore.get('line_access_token')?.value;

    if (!lineAccessToken) {
      return { success: false, error: 'ログインしていません' };
    }

    // 管理者権限チェック
    const roleResult = await checkUserRole(lineAccessToken);
    if (!roleResult.success) {
      return { success: false, error: roleResult.error || '権限の取得に失敗しました' };
    }
    
    // unavailableユーザーのサービス利用制限チェック
    if (!canUseServices(roleResult.role)) {
      return { success: false, error: 'サービスの利用が停止されています' };
    }
    
    if (roleResult.role !== 'admin') {
      return { success: false, error: '管理者権限が必要です' };
    }

    const users = await userService.getAllUsers();
    return { success: true, users };
  } catch (error) {
    console.error('ユーザー一覧取得エラー:', error);
    return { success: false, error: 'ユーザー一覧の取得中にエラーが発生しました' };
  }
};

/**
 * ユーザーの権限を更新するサーバーアクション
 */
export const updateUserRole = async (
  userId: string, 
  newRole: UserRole
): Promise<{ success: boolean; error?: string }> => {
  try {
    const cookieStore = await cookies();
    const lineAccessToken = cookieStore.get('line_access_token')?.value;

    if (!lineAccessToken) {
      return { success: false, error: 'ログインしていません' };
    }

    // 管理者権限チェック
    const roleResult = await checkUserRole(lineAccessToken);
    if (!roleResult.success) {
      return { success: false, error: roleResult.error || '権限の取得に失敗しました' };
    }
    
    // unavailableユーザーのサービス利用制限チェック
    if (!canUseServices(roleResult.role)) {
      return { success: false, error: 'サービスの利用が停止されています' };
    }
    
    if (roleResult.role !== 'admin') {
      return { success: false, error: '管理者権限が必要です' };
    }

    // バリデーション: 有効なロールかチェック
    const validRoles: UserRole[] = ['user', 'admin', 'unavailable'];
    if (!validRoles.includes(newRole)) {
      return { success: false, error: '無効な権限が指定されました' };
    }

    // ユーザーの存在確認
    const targetUser = await userService.getUserById(userId);
    if (!targetUser) {
      return { success: false, error: 'ユーザーが見つかりません' };
    }

    // 権限更新の実行
    await userService.updateUserRole(userId, newRole);

    return { success: true };
  } catch (error) {
    console.error('ユーザー権限更新エラー:', error);
    return { success: false, error: 'ユーザー権限の更新中にエラーが発生しました' };
  }
};