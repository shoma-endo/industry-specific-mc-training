import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/env'; // env モジュールをインポート
import { cookies } from 'next/headers';

// Node.jsランタイムを強制（Vercelエッジ環境でのCookie永続化問題を回避）
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // セキュアなstate検証（CSRF対策）
  const cookieStore = await cookies();
  const savedState = cookieStore.get('line_oauth_state')?.value;
  const savedNonce = cookieStore.get('line_oauth_nonce')?.value;

  // state検証: 必須・一致確認
  if (!state || !savedState || state !== savedState) {
    console.error('Invalid state parameter:', { state, savedState });
    return NextResponse.json(
      { error: 'Invalid state parameter. Possible CSRF attack.' },
      { status: 403 }
    );
  }

  // nonce検証（使い捨てトークン確認）
  if (!savedNonce) {
    console.error('Missing nonce in cookies');
    return NextResponse.json(
      { error: 'Invalid OAuth session' },
      { status: 403 }
    );
  }

  // 使用済みのstate/nonceを即座に削除（再利用攻撃防止）
  cookieStore.delete('line_oauth_state');
  cookieStore.delete('line_oauth_nonce');

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
      maxAge: 60 * 60 * 24 * 90, // 90日（check-roleと一致）
      path: '/',
    });

    return res;
  } catch (error) {
    console.error('Callback Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
