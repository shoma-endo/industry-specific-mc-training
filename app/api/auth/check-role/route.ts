import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserRoleWithRefresh } from '@/authUtils';

// Node.jsランタイムを強制（Cookie更新の一貫性を確保）
export const runtime = 'nodejs';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const lineAccessToken = cookieStore.get('line_access_token')?.value;
    const lineRefreshToken = cookieStore.get('line_refresh_token')?.value;

    if (!lineAccessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const result = await getUserRoleWithRefresh(lineAccessToken, lineRefreshToken);

    // 再認証が必要な場合
    if (result.needsReauth) {
      return NextResponse.json(
        { error: 'Token expired, re-authentication required', requires_login: true },
        { status: 401 }
      );
    }

    if (!result.role) {
      return NextResponse.json({ error: 'Unable to get user role' }, { status: 401 });
    }

    // レスポンスを作成
    const response = NextResponse.json({ role: result.role });

    // 新しいトークンが発行された場合、Cookieを更新
    if (result.newAccessToken) {
      // LINE APIレスポンスから取得したexpires_inを使用
      // expires_inが取得できない場合はデフォルト値（約30日 = 2592000秒）を使用
      const maxAge = result.expiresIn ?? 60 * 60 * 24 * 30; // デフォルト30日
      
      response.cookies.set('line_access_token', result.newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge,
        path: '/',
      });
    }

    if (result.newRefreshToken) {
      response.cookies.set('line_refresh_token', result.newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 90, // 90日
        path: '/',
      });
    }

    return response;
  } catch (error) {
    console.error('Role check API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
