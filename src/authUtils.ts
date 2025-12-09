import type { UserRole } from '@/types/user';

// =========================
// クライアント安全なヘルパー
// =========================
export function isAdmin(role: UserRole | null): boolean {
  return role === 'admin';
}

export function isUnavailable(role: UserRole | null): boolean {
  return role === 'unavailable';
}

export function canUseServices(role: UserRole | null): boolean {
  return role !== 'unavailable' && role !== null;
}

export function getRoleDisplayName(role: UserRole | null): string {
  switch (role) {
    case 'admin':
      return '管理者';
    case 'trial':
      return 'お試しユーザー';
    case 'paid':
      return '有料契約ユーザー';
    case 'unavailable':
      return 'サービス利用停止';
    default:
      return '不明';
  }
}

// =========================
// サーバー専用API（動的import + クライアントガード）
// =========================
export async function getUserRole(accessToken: string): Promise<UserRole | null> {
  if (typeof window !== 'undefined') {
    throw new Error('getUserRole can only be called on the server');
  }
  const { userService } = await import('@/server/services/userService');
  try {
    const user = await userService.getUserFromLiffToken(accessToken);
    if (!user) {
      return null;
    }
    return user.role || 'trial';
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
  if (typeof window !== 'undefined') {
    throw new Error('getUserRoleWithRefresh can only be called on the server');
  }
  const { userService } = await import('@/server/services/userService');
  try {
    const result = await userService.getUserFromLiffTokenWithRefresh(accessToken, refreshToken);
    if (result.needsReauth) {
      return { role: null, needsReauth: true };
    }
    if (!result.user) {
      return { role: null };
    }
    const role = result.user.role || 'trial';
    const returnValue: {
      role: UserRole;
      newAccessToken?: string;
      newRefreshToken?: string;
      needsReauth?: boolean;
    } = { role };
    if (result.newAccessToken) returnValue.newAccessToken = result.newAccessToken;
    if (result.newRefreshToken) returnValue.newRefreshToken = result.newRefreshToken;
    return returnValue;
  } catch (error) {
    console.error('[Auth Utils] Failed to get user role with refresh:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
    return { role: null };
  }
}
