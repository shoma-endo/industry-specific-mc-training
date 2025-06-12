import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

export async function GET() {
  const clientId = process.env.WORDPRESS_COM_CLIENT_ID;
  const redirectUri = process.env.WORDPRESS_COM_REDIRECT_URI;
  const stateCookieName = process.env.OAUTH_STATE_COOKIE_NAME || 'wpcom_oauth_state';

  console.log('OAuth環境変数確認:', {
    clientId: clientId ? '設定あり' : '未設定',
    redirectUri: redirectUri ? '設定あり' : '未設定',
    NODE_ENV: process.env.NODE_ENV
  });

  if (!clientId || !redirectUri) {
    console.error('WordPress.com OAuth environment variables are not set.');
    console.error('Missing variables:', {
      WORDPRESS_COM_CLIENT_ID: !clientId,
      WORDPRESS_COM_REDIRECT_URI: !redirectUri
    });
    return NextResponse.json({ error: 'OAuth 構成エラーです。' }, { status: 500 });
  }

  const state = randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'global', // 'global'スコープは投稿、メディア、サイト設定など広範なアクセスを要求します。必要に応じて調整してください。
    state: state,
    // blog: process.env.WORDPRESS_COM_SITE_ID || '', // 特定のサイトに限定する場合
  });

  const authorizationUrl = `https://public-api.wordpress.com/oauth2/authorize?${params.toString()}`;

  const response = NextResponse.redirect(authorizationUrl);

  // stateをHTTP Onlyのクッキーに保存
  response.cookies.set(stateCookieName, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 15, // 15 minutes
    sameSite: 'lax',
  });

  return response;
}
