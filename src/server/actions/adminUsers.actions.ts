'use server';

import { cookies } from 'next/headers';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import {
  isViewModeEnabled,
  resolveViewModeRole,
  VIEW_MODE_ERROR_MESSAGE,
} from '@/server/lib/view-mode';
import { ERROR_MESSAGES } from '@/domain/errors/error-messages';

export async function clearAuthCache() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('line_access_token')?.value;
    const refreshToken = cookieStore.get('line_refresh_token')?.value;
    const authResult = await authMiddleware(accessToken, refreshToken);
    if (authResult.error || !authResult.userId) {
      return { success: false, error: authResult.error || ERROR_MESSAGES.AUTH.USER_AUTH_FAILED };
    }
    if (await isViewModeEnabled(resolveViewModeRole(authResult))) {
      return { success: false, error: VIEW_MODE_ERROR_MESSAGE };
    }
    // 実際のキャッシュクリアエンドポイントを叩く（認証済み想定）
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/auth/clear-cache`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken ?? ''}`,
      },
    }).catch(() => null);

    return { success: true };
  } catch (error) {
    console.error('[admin/users] clear auth cache failed', error);
      return { success: false, error: ERROR_MESSAGES.ADMIN.CACHE_CLEAR_FAILED };
  }
}
