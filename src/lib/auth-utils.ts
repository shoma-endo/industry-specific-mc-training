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

export async function getUserRoleWithRefresh(
  accessToken: string,
  refreshToken?: string
): Promise<{
  role: UserRole | null;
  newAccessToken?: string;
  newRefreshToken?: string;
  needsReauth?: boolean;
}> {
  try {
    const result = await userService.getUserFromLiffTokenWithRefresh(accessToken, refreshToken);
    
    if (result.needsReauth) {
      return { role: null, needsReauth: true };
    }
    
    if (!result.user) {
      console.warn('[Auth Utils] User not found for access token');
      return { role: null };
    }
    
    // デフォルト値の確保
    const role = result.user.role || 'user';
    
    const returnValue: {
      role: UserRole;
      newAccessToken?: string;
      newRefreshToken?: string;
      needsReauth?: boolean;
    } = { role };
    
    if (result.newAccessToken) {
      returnValue.newAccessToken = result.newAccessToken;
    }
    
    if (result.newRefreshToken) {
      returnValue.newRefreshToken = result.newRefreshToken;
    }
    
    return returnValue;
  } catch (error) {
    console.error('[Auth Utils] Failed to get user role with refresh:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
    return { role: null };
  }
}

export function isAdmin(role: UserRole | null): boolean {
  return role === 'admin';
}

export function isUnavailable(role: UserRole | null): boolean {
  return role === 'unavailable';
}

export function canUseServices(role: UserRole | null): boolean {
  return role !== 'unavailable' && role !== null;
}

export function canAccess(userRole: UserRole | null, requiredRole: UserRole): boolean {
  if (!userRole) return false;
  
  // unavailableユーザーは全サービス利用不可
  if (userRole === 'unavailable') return false;
  
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
    case 'unavailable':
      return 'サービス利用停止';
    default:
      return '不明';
  }
}

