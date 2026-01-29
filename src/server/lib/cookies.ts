import { NextResponse } from 'next/server';

/**
 * LIFF (LINE Front-end Framework) のアクセストークンとリフレッシュトークンを
 * HTTP Only Cookie にセットするヘルパー関数
 *
 * @param response NextResponse オブジェクト
 * @param liffAccessToken LINEのアクセストークン
 * @param refreshToken LINEのリフレッシュトークン
 */
export function setLineTokens(
  response: NextResponse,
  liffAccessToken?: string,
  refreshToken?: string
) {
  // ローカル環境かどうかを判定（未設定 or httpsで始まらない場合はローカルとみなす）
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const isLocal = !siteUrl || !siteUrl.startsWith('https');

  // アクセストークンが存在する場合にCookieをセット
  if (liffAccessToken) {
    response.cookies.set('line_access_token', liffAccessToken, {
      httpOnly: true, // JSからはアクセス不可にする
      secure: !isLocal, // 本番はHTTPS必須、ローカルは無効
      sameSite: 'lax', // CSRF対策: プロジェクト全体で 'lax' に統一
      path: '/', // Cookieの適用パス
      maxAge: 30 * 24 * 60 * 60, // 有効期限：30日
    });
  }

  // リフレッシュトークンが存在する場合にCookieをセット
  if (refreshToken) {
    response.cookies.set('line_refresh_token', refreshToken, {
      httpOnly: true,
      secure: !isLocal,
      sameSite: 'lax', // CSRF対策: プロジェクト全体で 'lax' に統一
      path: '/',
      maxAge: 90 * 24 * 60 * 60, // 有効期限：90日
    });
  }
}
