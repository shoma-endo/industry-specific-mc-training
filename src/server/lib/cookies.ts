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
  // ローカル環境かどうかを判定（httpsで始まらない場合はローカルとみなす）
  const isLocal =
    typeof process.env.NEXT_PUBLIC_SITE_URL === 'string' &&
    !process.env.NEXT_PUBLIC_SITE_URL.startsWith('https');

  // アクセストークンが存在する場合にCookieをセット
  if (liffAccessToken) {
    response.cookies.set('line_access_token', liffAccessToken, {
      httpOnly: true, // JSからはアクセス不可にする
      secure: !isLocal, // 本番はHTTPS必須、ローカルは無効
      sameSite: isLocal ? 'lax' : 'none', // クロスサイト制限の設定
      path: '/', // Cookieの適用パス
      maxAge: 30 * 24 * 60 * 60, // 有効期限：30日
    });
  }

  // リフレッシュトークンが存在する場合にCookieをセット
  if (refreshToken) {
    response.cookies.set('line_refresh_token', refreshToken, {
      httpOnly: true,
      secure: !isLocal,
      sameSite: isLocal ? 'lax' : 'none',
      path: '/',
      maxAge: 90 * 24 * 60 * 60, // 有効期限：90日
    });
  }
}
