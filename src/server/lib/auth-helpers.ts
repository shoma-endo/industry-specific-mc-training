import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import type { User, UserRole } from '@/types/user';
import { userService } from '@/server/services/userService';
import { getUserRoleWithRefresh } from '@/authUtils';
import { ERROR_MESSAGES } from '@/domain/errors/error-messages';

type AuthHeaderSuccess = {
  ok: true;
  user: User;
  role: UserRole | null;
  token: string;
};

type AuthHeaderFailure = {
  ok: false;
  response: NextResponse;
};

export type AuthHeaderResult = AuthHeaderSuccess | AuthHeaderFailure;

/**
 * Authorization ヘッダーから LIFF トークンを取得してユーザー情報を返す
 * @param req NextRequest
 * @returns AuthHeaderResult
 */
export async function getUserFromAuthHeader(req: NextRequest): Promise<AuthHeaderResult> {
  const authHeader = req.headers.get('Authorization');
  const rawToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!rawToken) {
    return { ok: false, response: NextResponse.json({ error: ERROR_MESSAGES.AUTH.UNAUTHENTICATED }, { status: 401 }) };
  }

  const { role, needsReauth, newAccessToken } = await getUserRoleWithRefresh(rawToken);
  if (needsReauth) {
    return {
      ok: false,
      response: NextResponse.json({ error: ERROR_MESSAGES.AUTH.REAUTHENTICATION_REQUIRED }, { status: 401 }),
    };
  }

  const effectiveToken = newAccessToken ?? rawToken;
  const user = await userService.getUserFromLiffToken(effectiveToken);
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: ERROR_MESSAGES.USER.USER_NOT_FOUND }, { status: 401 }) };
  }

  return {
    ok: true,
    user,
    role: role ?? user.role ?? null,
    token: effectiveToken,
  };
}

/**
 * LIFF トークンの型定義
 */
type LiffTokens = {
  accessToken: string | undefined;
  refreshToken: string | undefined;
};

/**
 * Cookie から LIFF トークンを抽出する共通ロジック
 * @param getCookie Cookie 取得関数
 * @returns { accessToken, refreshToken }
 */
function extractLiffTokens(getCookie: (name: string) => string | undefined): LiffTokens {
  return {
    accessToken: getCookie('line_access_token'),
    refreshToken: getCookie('line_refresh_token'),
  };
}

/**
 * Cookie から LIFF トークン（access & refresh）を取得する（Server Actions 用）
 * @returns { accessToken, refreshToken }
 */
export async function getLiffTokensFromCookies(): Promise<LiffTokens> {
  const cookieStore = await cookies();
  return extractLiffTokens((name) => cookieStore.get(name)?.value);
}

/**
 * NextRequest から LIFF トークン（access & refresh）を取得する（Route Handlers 用）
 * @param req NextRequest
 * @returns { accessToken, refreshToken }
 */
export function getLiffTokensFromRequest(req: NextRequest): LiffTokens {
  return extractLiffTokens((name) => req.cookies.get(name)?.value);
}

