import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { verifyOAuthState } from '@/server/lib/oauth-state';
import { GoogleAdsService } from '@/server/services/googleAdsService';
import { SupabaseService } from '@/server/services/supabaseService';
import { ERROR_MESSAGES } from '@/domain/errors/error-messages';
import { toUser } from '@/types/user';
import { isAdmin } from '@/authUtils';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const cookieStore = await cookies();
  const liffAccessToken = cookieStore.get('line_access_token')?.value;
  const refreshToken = cookieStore.get('line_refresh_token')?.value;
  const redirectUri = process.env.GOOGLE_ADS_REDIRECT_URI ?? '';
  const cookieSecret = process.env.COOKIE_SECRET ?? '';
  const stateCookieName = 'gads_oauth_state';

  // redirectUri からベース URL を取得（ngrok URL を維持するため）
  const baseUrl = redirectUri.replace('/api/google-ads/oauth/callback', '') || request.url;

  if (error) {
    console.error('❌ Google Ads OAuth Error:', error);
    return NextResponse.redirect(new URL('/setup/google-ads?error=auth_failed', baseUrl));
  }

  if (!code || !state) {
    console.error('❌ code または state がありません');
    return NextResponse.redirect(new URL('/setup/google-ads?error=missing_params', baseUrl));
  }

  try {
    // State検証
    const storedState = cookieStore.get(stateCookieName)?.value;

    // 1. CSRF対策: クッキーに保存されたStateと一致するか
    if (!storedState || storedState !== state) {
      console.error('OAuth state mismatch', { stored: !!storedState, received: !!state });
      const response = NextResponse.redirect(
        new URL('/setup/google-ads?error=state_cookie_mismatch', baseUrl)
      );
      response.cookies.delete(stateCookieName);
      return response;
    }

    // 2. Stateの内容検証 (署名, 有効期限)
    const verification = verifyOAuthState(state, cookieSecret);
    if (!verification.valid) {
      console.error('Invalid OAuth state:', verification.reason);
      const response = NextResponse.redirect(
        new URL(`/setup/google-ads?error=${encodeURIComponent(verification.reason)}`, baseUrl)
      );
      response.cookies.delete(stateCookieName);
      return response;
    }

    // 3. ユーザーID取得（GSC と同じロジック：state の userId を優先）
    let targetUserId: string | null = verification.payload.userId;

    // LINE token があれば検証（なくても state の userId で進める）
    if (liffAccessToken) {
      const authResult = await authMiddleware(liffAccessToken, refreshToken);
      if (!authResult.error && authResult.userId) {
        if (authResult.viewMode || authResult.ownerUserId) {
          const response = NextResponse.redirect(
            new URL(
              `/setup/google-ads?error=${encodeURIComponent(ERROR_MESSAGES.AUTH.OWNER_ACCOUNT_REQUIRED)}`,
              baseUrl
            )
          );
          response.cookies.delete(stateCookieName);
          return response;
        }

        // ユーザーID整合性確認
        if (targetUserId && targetUserId !== authResult.userId) {
          console.error('OAuth state user mismatch', {
            stateUser: targetUserId,
            currentUser: authResult.userId,
          });
          const response = NextResponse.redirect(
            new URL('/setup/google-ads?error=state_user_mismatch', baseUrl)
          );
          response.cookies.delete(stateCookieName);
          return response;
        }

        targetUserId = authResult.userId;
      }
    }

    // targetUserId が最終的にない場合のみエラー
    if (!targetUserId) {
      console.error('❌ userId が取得できません');
      const response = NextResponse.redirect(
        new URL('/setup/google-ads?error=auth_required', baseUrl)
      );
      response.cookies.delete(stateCookieName);
      return response;
    }

    // 管理者権限チェック（Google Ads 連携は審査完了まで管理者のみ）
    const supabaseService = new SupabaseService();
    const userResult = await supabaseService.getUserById(targetUserId);
    if (!userResult.success || !userResult.data) {
      console.error(
        '❌ ユーザー情報が取得できません:',
        userResult.success ? 'データなし' : userResult.error
      );
      const response = NextResponse.redirect(
        new URL('/setup/google-ads?error=server_error', baseUrl)
      );
      response.cookies.delete(stateCookieName);
      return response;
    }
    const user = toUser(userResult.data);
    if (!isAdmin(user.role)) {
      console.warn('⚠️ 非管理者ユーザーが Google Ads 連携を試行:', targetUserId);
      const response = NextResponse.redirect(new URL('/unauthorized', baseUrl));
      response.cookies.delete(stateCookieName);
      return response;
    }

    // トークン交換
    const googleAdsService = new GoogleAdsService();
    const tokens = await googleAdsService.exchangeCodeForTokens(code, redirectUri);

    if (!tokens.refreshToken) {
      // 既に連携済みの場合はリフレッシュトークンが返ってこないことがある
      // 今回は初回連携前提のためエラーとするか、または強制的に再同意させるプロンプトをstart側で設定済み
      console.warn('No refresh token returned');
    }

    // DB保存
    await supabaseService.saveGoogleAdsCredential(targetUserId, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken || '', // 必須だが、ない場合は空文字で保存して後でエラーにする運用も可
      expiresIn: tokens.expiresIn,
      scope: tokens.scope || [],
    });

    // 成功
    const response = NextResponse.redirect(new URL('/setup/google-ads?success=true', baseUrl));
    response.cookies.delete(stateCookieName);
    return response;
  } catch (err) {
    console.error('Google Ads Callback Error:', err);
    return NextResponse.redirect(new URL('/setup/google-ads?error=server_error', baseUrl));
  }
}
