import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/server/services/supabaseService';
import { authMiddleware } from '@/server/middleware/auth.middleware';

const supabaseService = new SupabaseService();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const clientId = process.env.WORDPRESS_COM_CLIENT_ID;
  const clientSecret = process.env.WORDPRESS_COM_CLIENT_SECRET;
  const redirectUri = process.env.WORDPRESS_COM_REDIRECT_URI;
  const stateCookieName = process.env.OAUTH_STATE_COOKIE_NAME || 'wpcom_oauth_state';
  const tokenCookieName = process.env.OAUTH_TOKEN_COOKIE_NAME || 'wpcom_oauth_token';
  const cookieSecret = process.env.COOKIE_SECRET;

  if (!clientId || !clientSecret || !redirectUri || !cookieSecret) {
    console.error('WordPress.com OAuth callback environment variables are not set.');
    return NextResponse.json({ error: 'OAuth configuration error.' }, { status: 500 });
  }

  // LIFFアクセストークンを取得
  const liffAccessToken = request.cookies.get('line_access_token')?.value;
  if (!liffAccessToken) {
    console.error('LIFF access token not found in callback');
    return NextResponse.json({ error: 'LINE認証が必要です' }, { status: 401 });
  }

  const storedState = request.cookies.get(stateCookieName)?.value;

  if (!state || !storedState || state !== storedState) {
    console.error('Invalid OAuth state.', { receivedState: state, storedState });
    return NextResponse.json({ error: 'Invalid state. CSRF attack?' }, { status: 400 });
  }

  // State is valid, clear the state cookie
  const clearStateCookie = NextResponse.next(); // Use a temporary response to clear cookie first
  clearStateCookie.cookies.delete(stateCookieName);

  if (!code) {
    console.error('Authorization code not found in callback.');
    return NextResponse.json({ error: 'Authorization code missing.' }, { status: 400 });
  }

  try {
    const tokenResponse = await fetch('https://public-api.wordpress.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error('Failed to fetch access token:', tokenResponse.status, errorBody);
      return NextResponse.json(
        { error: 'Failed to obtain access token.', details: errorBody },
        { status: tokenResponse.status }
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, expires_in } = tokenData;

    if (!access_token) {
      console.error('Access token not found in response from WordPress.com', tokenData);
      return NextResponse.json({ error: 'Access token not received.' }, { status: 500 });
    }

    // ユーザー認証を確認
    const refreshToken = request.cookies.get('line_refresh_token')?.value;
    const authResult = await authMiddleware(liffAccessToken, refreshToken);

    if (authResult.error || !authResult.userId) {
      console.error('User authentication failed in OAuth callback:', authResult.error);
      return NextResponse.json({ error: 'ユーザー認証に失敗しました' }, { status: 401 });
    }

    // WordPress.com のサイト情報を取得
    try {
      // 1) まず既存のユーザー設定からサイトIDを参照
      const existingSettings = await supabaseService.getWordPressSettingsByUserId(
        authResult.userId
      );
      let siteId = existingSettings?.wpSiteId || '';

      // 2) 未設定の場合は、WordPress.com APIからサイト一覧を取得して先頭を利用
      if (!siteId) {
        const sitesResponse = await fetch('https://public-api.wordpress.com/rest/v1.1/me/sites', {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        });

        if (sitesResponse.ok) {
          const sitesData = await sitesResponse.json();
          if (sitesData.sites && sitesData.sites.length > 0) {
            siteId = sitesData.sites[0].ID.toString();
          }
        }
      }

      // 3) WordPress設定をデータベースに保存（クライアントID/シークレットと合わせて）
      if (siteId && clientId && clientSecret) {
        await supabaseService.createOrUpdateWordPressSettings(
          authResult.userId,
          clientId,
          clientSecret,
          siteId
        );
      }
    } catch (error) {
      console.error('Error saving WordPress settings:', error);
      // エラーが発生してもOAuth処理は継続
    }

    // Store the access token securely in an HTTP Only cookie
    // Note: For production, consider server-side session storage for tokens.
    const response = NextResponse.redirect(new URL('/setup', request.url)); // Redirect to setup page
    response.cookies.set(tokenCookieName, access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: expires_in || 3600 * 24 * 14, // Default to 14 days if not provided
      sameSite: 'lax',
    });

    // Also clear the state cookie on the final response
    response.cookies.delete(stateCookieName); // Ensure state cookie is cleared

    return response;
  } catch (error) {
    console.error('Error during OAuth callback:', error);
    return NextResponse.json(
      { error: 'Internal server error during OAuth callback.' },
      { status: 500 }
    );
  }
}
