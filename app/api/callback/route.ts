import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/env'; // env モジュールをインポート
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // state パラメータも取得

  // 例: 事前にセッションに保存した state と比較する
  const cookieStore = await cookies();
  const savedState = cookieStore.get('line_oauth_state')?.value;
  if (!state || state !== savedState) {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 });
  }
  cookieStore.delete('line_oauth_state'); // 使用済みの state を削除

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  try {
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        // redirect_uri はログインリクエスト時と同じものを指定する必要があります
        redirect_uri: `${env.NEXT_PUBLIC_SITE_URL}/api/line/callback`,
        client_id: env.LINE_CHANNEL_ID, // サーバーサイド用の Channel ID
        client_secret: env.LINE_CHANNEL_SECRET, // Channel Secret
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error('LINE Token API Error:', tokenData);
      return NextResponse.json(
        { error: 'Failed to fetch LINE token', details: tokenData },
        { status: tokenRes.status }
      );
    }

    // ここでリフレッシュトークンとアクセストークンを安全に保存します。
    // 例: データベースにユーザー情報と紐付けて保存、セッションストアに保存など。
    // Cookie に保存する場合、httpOnly, secure, sameSite 属性を適切に設定してください。

    // ユーザーを認証後のページ（例: ホーム画面）にリダイレクト
    const redirectUrl = new URL('/', env.NEXT_PUBLIC_SITE_URL);
    const res = NextResponse.redirect(redirectUrl);

    // Cookieにトークンを保存 (httpOnlyでJSからのアクセスを防ぐ)
    // Secure属性は HTTPS でのみ送信されるようにするため、本番環境では true を推奨
    // SameSite属性は CSRF 対策として 'Lax' または 'Strict' を推奨
    // maxAge はアクセストークンの有効期限 (秒) に合わせると良いでしょう
    res.cookies.set('line_access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenData.expires_in,
      path: '/',
    });
    // リフレッシュトークンは有効期限が長いことが多いですが、アクセストークンよりは厳重に管理
    res.cookies.set('line_refresh_token', tokenData.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      // リフレッシュトークン自体の有効期限は通常指定されないか、非常に長いため、
      // 必要に応じて maxAge を設定 (例: 90日)
      // maxAge: 90 * 24 * 60 * 60,
      path: '/',
    });

    return res;
  } catch (error) {
    console.error('Callback Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
