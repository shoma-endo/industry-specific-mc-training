'use server';

import { cookies } from 'next/headers';
import { authMiddleware } from '@/server/middleware/auth.middleware';

export async function clearAuthCache() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('line_access_token')?.value;
    const refreshToken = cookieStore.get('line_refresh_token')?.value;
    const authResult = await authMiddleware(accessToken, refreshToken);
    if (authResult.error || !authResult.userId) {
      return { success: false, error: authResult.error || 'ユーザー認証に失敗しました' };
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
    return { success: false, error: 'キャッシュクリアに失敗しました' };
  }
}
