import { userService } from '@/server/services/userService';
import type { UserRole } from '@/types/user';

export async function getUserRole(accessToken: string): Promise<UserRole | null> {
  try {
    const user = await userService.getUserFromLiffToken(accessToken);
    
    if (!user) {
      console.warn('[Auth Utils] User not found for access token');
      return null;
    }
    
    // デフォルト値の確保
    const role = user.role || 'user';
    
    return role;
  } catch (error) {
    console.error('[Auth Utils] Failed to get user role:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
    return null;
  }
}

export function isAdmin(role: UserRole | null): boolean {
  return role === 'admin';
}

export function canAccess(userRole: UserRole | null, requiredRole: UserRole): boolean {
  if (!userRole) return false;
  
  // adminは全てにアクセス可能
  if (userRole === 'admin') return true;
  
  // userはuser権限が必要な場所にのみアクセス可能
  return userRole === requiredRole;
}

// ページコンポーネント用のヘルパー
export function getRoleDisplayName(role: UserRole | null): string {
  switch (role) {
    case 'admin':
      return '管理者';
    case 'user':
      return '一般ユーザー';
    default:
      return '不明';
  }
}

// デバッグ用（開発環境のみ）
export function debugUserRole(role: UserRole | null, context: string) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Auth Debug] ${context}: role = ${role}`);
  }
}