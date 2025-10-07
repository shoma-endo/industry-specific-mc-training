'use server';

import { cookies as nextCookies } from 'next/headers';
import Stripe from 'stripe';

import { LineAuthService, LineTokenExpiredError } from '@/server/services/lineAuthService';
import { StripeService } from '@/server/services/stripeService';
import { userService } from '@/server/services/userService';
import { isUnavailable } from '@/auth-utils';
import { env } from '@/env';
import type { User } from '@/types/user';

export type EnsureAuthenticatedOptions = {
  accessToken?: string;
  refreshToken?: string;
  allowDevelopmentBypass?: boolean;
  skipSubscriptionCheck?: boolean;
};

export type AuthenticatedUser = {
  lineUserId: string;
  userId: string;
  requiresSubscription: boolean;
  subscription: Stripe.Subscription | null;
  user?: { id: string };
  userDetails?: User | null;
  error?: string;
  newAccessToken?: string;
  newRefreshToken?: string;
  needsReauth?: boolean;
};

export type AuthMiddlewareResult = AuthenticatedUser;

export type RefreshTokensResult = {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
  status?: number;
};

const DEFAULT_ACCESS_TOKEN_MAX_AGE = 60 * 60 * 24 * 3; // 3日
const DEFAULT_REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 90; // 90日

export type AuthCookieOptions = {
  sameSite?: 'lax' | 'strict' | 'none';
  accessTokenMaxAge?: number;
  refreshTokenMaxAge?: number;
  secure?: boolean;
  path?: string;
};

export async function ensureAuthenticated({
  accessToken,
  refreshToken,
  allowDevelopmentBypass = true,
  skipSubscriptionCheck = false,
}: EnsureAuthenticatedOptions): Promise<AuthenticatedUser> {
const withTokens = (
  result: AuthenticatedUser,
  tokens: { accessToken?: string | null; refreshToken?: string | null }
): AuthenticatedUser => {
  if (tokens.accessToken != null) {
    result.newAccessToken = tokens.accessToken;
  }
  if (tokens.refreshToken != null) {
    result.newRefreshToken = tokens.refreshToken;
  }
  return result;
};
  if (allowDevelopmentBypass && process.env.NODE_ENV === 'development' && accessToken === 'dummy-token') {
    return {
      lineUserId: 'dummy-line-user-id',
      userId: 'dummy-app-user-id',
      requiresSubscription: false,
      subscription: null,
      user: { id: 'dummy-app-user-id' },
      userDetails: null,
    };
  }

  if (!accessToken) {
    return {
      error: 'Liff Access Token is required',
      lineUserId: '',
      userId: '',
      requiresSubscription: false,
      subscription: null,
      userDetails: null,
    };
  }

  const lineAuthService = new LineAuthService();

  let latestAccessToken: string | undefined;
  let latestRefreshToken: string | undefined;

  try {
    const verificationResult = await lineAuthService.verifyLineTokenWithRefresh(accessToken, refreshToken);

    if (!verificationResult.isValid || verificationResult.needsReauth) {
      return withTokens(
        {
          error: 'Invalid or expired LINE token. Re-authentication required.',
          lineUserId: '',
          userId: '',
          requiresSubscription: true,
          subscription: null,
          needsReauth: Boolean(verificationResult.needsReauth),
          userDetails: null,
        },
        {
          accessToken: verificationResult.newAccessToken ?? null,
          refreshToken: verificationResult.newRefreshToken ?? null,
        }
      );
    }

    latestAccessToken = verificationResult.newAccessToken;
    latestRefreshToken = verificationResult.newRefreshToken;

    const currentAccessToken = verificationResult.newAccessToken || accessToken;
    const lineProfile = await lineAuthService.getLineProfile(currentAccessToken);

    if (!lineProfile || !lineProfile.userId) {
      return withTokens(
        {
          error: 'Failed to get LINE user profile',
          lineUserId: '',
          userId: '',
          requiresSubscription: false,
          subscription: null,
          userDetails: null,
        },
        { accessToken: latestAccessToken ?? null, refreshToken: latestRefreshToken ?? null }
      );
    }

    const user = await userService.getUserFromLiffToken(currentAccessToken);
    if (!user) {
      return withTokens(
        {
          error: 'Application user not found for this LINE user.',
          lineUserId: lineProfile.userId,
          userId: '',
          requiresSubscription: false,
          subscription: null,
          userDetails: null,
        },
        { accessToken: latestAccessToken ?? null, refreshToken: latestRefreshToken ?? null }
      );
    }

    if (isUnavailable(user.role)) {
      return withTokens(
        {
          error: 'サービスの利用が停止されています',
          lineUserId: lineProfile.userId,
          userId: user.id,
          requiresSubscription: false,
          subscription: null,
          user: { id: user.id },
          userDetails: user,
        },
        { accessToken: latestAccessToken ?? null, refreshToken: latestRefreshToken ?? null }
      );
    }

    const shouldCheckSubscription = !skipSubscriptionCheck && env.STRIPE_ENABLED === 'true';

    const baseResult: AuthenticatedUser = withTokens(
      {
        lineUserId: lineProfile.userId,
        userId: user.id,
        requiresSubscription: false,
        subscription: null,
        user: { id: user.id },
        userDetails: user,
      },
      { accessToken: latestAccessToken ?? null, refreshToken: latestRefreshToken ?? null }
    );

    if (!shouldCheckSubscription) {
      return baseResult;
    }

    const stripeService = new StripeService();
    const isSubscribed = await stripeService.checkSubscriptionStatus(user.id);

    let actualSubscription: Stripe.Subscription | null = null;
    if (user.stripeSubscriptionId) {
      try {
        actualSubscription = await stripeService.getSubscription(user.stripeSubscriptionId);
      } catch (subscriptionError) {
        console.error('[Auth Middleware] Failed to fetch Stripe subscription:', subscriptionError);
      }
    }

    if (!isSubscribed) {
      return {
        ...baseResult,
        error: 'Subscription required',
        requiresSubscription: true,
        subscription: actualSubscription,
      };
    }

    return {
      ...baseResult,
      subscription: actualSubscription,
    };
  } catch (error) {
    console.error('[Auth Middleware] Error during ensureAuthenticated:', error);
    let errorMessage = '[Auth Middleware] Unknown error occurred';
    let needsReauth = false;
    if (error instanceof LineTokenExpiredError) {
      errorMessage = 'LINE token has expired. Please re-authenticate.';
      needsReauth = true;
    } else if (error instanceof Error) {
      errorMessage = error.message.startsWith('[Auth Middleware]')
        ? error.message
        : `[Auth Middleware] ${error.message}`;
    }

    return withTokens(
      {
        error: errorMessage,
        lineUserId: '',
        userId: '',
        requiresSubscription: false,
        subscription: null,
        needsReauth,
        userDetails: null,
      },
      { accessToken: latestAccessToken ?? null, refreshToken: latestRefreshToken ?? null }
    );
  }
}

export async function authMiddleware(
  liffAccessToken?: string,
  refreshTokenValue?: string,
  options?: Omit<EnsureAuthenticatedOptions, 'accessToken' | 'refreshToken'>
): Promise<AuthMiddlewareResult> {
  return ensureAuthenticated({
    ...(liffAccessToken ? { accessToken: liffAccessToken } : {}),
    ...(refreshTokenValue ? { refreshToken: refreshTokenValue } : {}),
    ...options,
  });
}

export async function refreshTokens(refreshToken: string): Promise<RefreshTokensResult> {
  try {
    const response = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: env.LINE_CHANNEL_ID,
        client_secret: env.LINE_CHANNEL_SECRET,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data?.error_description || 'Failed to refresh LINE token';
      return {
        success: false,
        error: errorMessage,
        status: response.status,
      };
    }

    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  } catch (error) {
    console.error('[Auth Middleware] Refresh token error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function setAuthCookies(
  accessToken: string,
  refreshToken?: string,
  options: AuthCookieOptions = {}
): Promise<void> {
  const {
    sameSite = 'lax',
    accessTokenMaxAge = DEFAULT_ACCESS_TOKEN_MAX_AGE,
    refreshTokenMaxAge = DEFAULT_REFRESH_TOKEN_MAX_AGE,
    secure = process.env.NODE_ENV === 'production',
    path = '/',
  } = options;

  const cookies = await nextCookies();
  cookies.set('line_access_token', accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    path,
    maxAge: accessTokenMaxAge,
  });

  if (refreshToken) {
    cookies.set('line_refresh_token', refreshToken, {
      httpOnly: true,
      secure,
      sameSite,
      path,
      maxAge: refreshTokenMaxAge,
    });
  }
}

export async function clearAuthCookies(): Promise<void> {
  const cookies = await nextCookies();
  cookies.delete('line_access_token');
  cookies.delete('line_refresh_token');
}
