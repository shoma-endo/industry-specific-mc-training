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
}

/**
 * Server Actions/Route Handlers用の認証ラッパー
 *
 * 25ファイルで重複していた認証パターンを統一的に処理します。
 *
 * @example
 * export async function getWordPressSettings() {
 *   return withAuth(async ({ userId }) => {
 *     return await supabaseService.getWordPressSettingsByUserId(userId);
 *   });
 * }
 *
 * @example cookieStoreも使用する場合
 * export async function someAction() {
 *   return withAuth(async ({ userId, cookieStore }) => {
 *     const token = cookieStore.get('some_token')?.value;
 *     return await doSomething(userId, token);
 *   });
 * }
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
  });
}
