import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { clearAuthCookies, refreshTokens, setAuthCookies } from '@/server/middleware/auth.middleware';

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('line_refresh_token')?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token found in cookies' }, { status: 401 });
  }

  const result = await refreshTokens(refreshToken);

  if (!result.success || !result.accessToken) {
    if (result.status === 400 || result.status === 401) {
      await clearAuthCookies();
      return NextResponse.json(
        {
          error: result.error || 'Invalid refresh token',
          requires_login: true,
        },
        { status: result.status ?? 400 }
      );
    }

    return NextResponse.json(
      {
        error: result.error || 'Failed to refresh LINE token',
      },
      { status: result.status ?? 500 }
    );
  }

  await setAuthCookies(result.accessToken, result.refreshToken);

  return NextResponse.json({ message: 'Token refreshed successfully' });
}
