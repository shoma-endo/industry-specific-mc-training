import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';

import {
  ensureAuthenticated,
  clearAuthCookies,
  setAuthCookies,
} from '@/server/middleware/auth.middleware';

export async function GET() {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const authorizationHeader = requestHeaders.get('authorization');
  const bearerToken =
    authorizationHeader && authorizationHeader.startsWith('Bearer ')
      ? authorizationHeader.slice('Bearer '.length).trim()
      : undefined;
  const cookieAccessToken = cookieStore.get('line_access_token')?.value;
  const refreshToken = cookieStore.get('line_refresh_token')?.value;

  const accessToken = bearerToken ?? cookieAccessToken;

  if (!accessToken) {
    return NextResponse.json({ userId: null, user: null });
  }

  try {
    const authResult = await ensureAuthenticated({
      ...(accessToken ? { accessToken } : {}),
      ...(refreshToken ? { refreshToken } : {}),
      skipSubscriptionCheck: true,
    });

    if (authResult.error) {
      if (authResult.needsReauth) {
        await clearAuthCookies();
        return NextResponse.json({ userId: null, needsReauth: true });
      }

      return NextResponse.json({ userId: null, user: null, error: authResult.error });
    }

    const user = authResult.userDetails;

    // レスポンスを一度だけ作成（最小限のユーザー情報を含める）
    const response = NextResponse.json({
      userId: user?.id ?? null,
      user: user
        ? {
            id: user.id,
            fullName: user.fullName ?? null,
            role: user.role,
            lineDisplayName: user.lineDisplayName,
            linePictureUrl: user.linePictureUrl ?? null,
          }
        : null,
      tokenRefreshed: Boolean(authResult.newAccessToken),
    });

    // 新しいトークンが取得された場合、クッキーを更新
    if (
      authResult.newAccessToken ||
      authResult.newRefreshToken ||
      !cookieAccessToken ||
      (bearerToken && bearerToken !== cookieAccessToken)
    ) {
      await setAuthCookies(
        authResult.newAccessToken ?? accessToken,
        authResult.newRefreshToken ?? refreshToken,
        {
          sameSite: 'strict',
          refreshTokenMaxAge: 60 * 60 * 24 * 30,
        }
      );
    }
    return response;
  } catch (error) {
    console.error('[User Current API] Error:', error);
    return NextResponse.json({ userId: null, user: null });
  }
}
