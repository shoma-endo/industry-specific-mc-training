import { cookies } from 'next/headers';
import { authMiddleware } from './auth.middleware';
import type { User, UserRole } from '@/types/user';
import { resolveViewModeRole } from '@/server/lib/view-mode';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

/**
 * 認証コンテキスト
 */
export interface AuthContext {
  userId: string;
  cookieStore: ReadonlyRequestCookies;
  userDetails?: User | null;
  viewModeRole?: UserRole | null;
  ownerUserId?: string | null | undefined;
  actorUserId?: string | undefined;
}

/**
 * Server Actions/Route Handlers用の認証ラッパー
 * ... (snip) ...
 */
export async function withAuth<T>(handler: (context: AuthContext) => Promise<T>): Promise<T> {
  const cookieStore = await cookies();
  const liffAccessToken = cookieStore.get('line_access_token')?.value;
  const refreshToken = cookieStore.get('line_refresh_token')?.value;

  const authResult = await authMiddleware(liffAccessToken, refreshToken);

  if (authResult.error || !authResult.userId) {
    throw new Error(authResult.error || '認証に失敗しました');
  }

  return handler({
    userId: authResult.userId,
    cookieStore,
    userDetails: authResult.userDetails ?? null,
    viewModeRole: resolveViewModeRole(authResult),
    ownerUserId: authResult.ownerUserId,
    actorUserId: authResult.actorUserId,
  });
}
