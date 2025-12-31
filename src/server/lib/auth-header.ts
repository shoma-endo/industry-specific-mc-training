import { NextResponse, type NextRequest } from 'next/server';
import type { User, UserRole } from '@/types/user';
import { userService } from '@/server/services/userService';
import { getUserRoleWithRefresh } from '@/authUtils';

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

export async function getUserFromAuthHeader(req: NextRequest): Promise<AuthHeaderResult> {
  const authHeader = req.headers.get('Authorization');
  const rawToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!rawToken) {
    return { ok: false, response: NextResponse.json({ error: '未認証' }, { status: 401 }) };
  }

  const { role, needsReauth, newAccessToken } = await getUserRoleWithRefresh(rawToken);
  if (needsReauth) {
    return {
      ok: false,
      response: NextResponse.json({ error: '再認証が必要です' }, { status: 401 }),
    };
  }

  const effectiveToken = newAccessToken ?? rawToken;
  const user = await userService.getUserFromLiffToken(effectiveToken);
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 401 }) };
  }

  return {
    ok: true,
    user,
    role: role ?? user.role ?? null,
    token: effectiveToken,
  };
}
