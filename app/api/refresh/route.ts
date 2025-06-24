import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { env } from '@/env'; // env モジュールをインポート

export async function POST() {
  // POST メソッドに変更推奨
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('line_refresh_token')?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token found in cookies' }, { status: 401 }); // 401 Unauthorized がより適切
  }

  try {
    const refreshRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: env.LINE_CHANNEL_ID, // サーバーサイド用の Channel ID
        client_secret: env.LINE_CHANNEL_SECRET, // Channel Secret
      }),
    });

    const refreshData = await refreshRes.json();

    if (!refreshRes.ok) {
      console.error('LINE Refresh Token API Error:', refreshData);
      // リフレッシュトークンが無効な場合 (例: revoked)、再度ログインを促す必要がある
      if (refreshRes.status === 400) {
        const res = NextResponse.json(
          {
            error: 'Invalid refresh token',
            requires_login: true,
            details: refreshData,
            login_url: `${env.NEXT_PUBLIC_SITE_URL}/login`,
          },
          { status: 400 }
        );
        // 古いトークンを削除
        res.cookies.delete('line_access_token');
        res.cookies.delete('line_refresh_token');
        return res;
      }
      return NextResponse.json(
        { error: 'Failed to refresh LINE token', details: refreshData },
        { status: refreshRes.status }
      );
    }


    // 新しいトークンをCookieに保存
    const res = NextResponse.json({ message: 'Token refreshed successfully' });

    res.cookies.set('line_access_token', refreshData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: refreshData.expires_in,
      path: '/',
    });
    // LINE はリフレッシュ時に新しいリフレッシュトークンを返す場合があるため、こちらも更新
    res.cookies.set('line_refresh_token', refreshData.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return res;
  } catch (error) {
    console.error('Refresh Token Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
