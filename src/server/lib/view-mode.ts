import { cookies } from 'next/headers';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import type { UserRole } from '@/types/user';

export const VIEW_MODE_ERROR_MESSAGE = '閲覧モードでは操作できません';

const getViewModeCookieEnabled = async (): Promise<boolean> => {
  const cookieStore = await cookies();
  return cookieStore.get('owner_view_mode')?.value === '1';
};

export const isViewModeEnabledByRole = (
  role: UserRole | null,
  hasViewModeCookie: boolean
): boolean => {
  return role === 'owner' && hasViewModeCookie;
};

export const resolveViewModeRole = (authResult: {
  viewMode?: boolean;
  actorRole?: UserRole | null;
  userDetails?: { role?: UserRole | null } | null;
}): UserRole | null => {
  if (authResult.viewMode) {
    return authResult.actorRole ?? authResult.userDetails?.role ?? null;
  }
  return authResult.userDetails?.role ?? null;
};

const resolveRoleFromCookies = async (): Promise<UserRole | null> => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('line_access_token')?.value;
  const refreshToken = cookieStore.get('line_refresh_token')?.value;

  if (!accessToken && !refreshToken) {
    return null;
  }

  const authResult = await authMiddleware(accessToken, refreshToken, {
    // 閲覧モード判定では課金状態ではなくロールのみ必要なためスキップ
    skipSubscriptionCheck: true,
  });

  if (authResult.error) {
    return null;
  }

  return resolveViewModeRole(authResult);
};

export const isViewModeEnabled = async (role?: UserRole | null): Promise<boolean> => {
  const hasViewModeCookie = await getViewModeCookieEnabled();
  if (!hasViewModeCookie) {
    return false;
  }

  if (role !== undefined) {
    return isViewModeEnabledByRole(role ?? null, hasViewModeCookie);
  }

  const resolvedRole = await resolveRoleFromCookies();
  return isViewModeEnabledByRole(resolvedRole, hasViewModeCookie);
};
