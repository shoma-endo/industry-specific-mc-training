import type { authMiddleware } from '@/server/middleware/auth.middleware';
import type { UserService } from '@/server/services/userService';

export interface EnsureAuthorizedUserSuccess {
  success: true;
  authResult: Awaited<ReturnType<typeof authMiddleware>>;
  user: Awaited<ReturnType<UserService['getUserFromLiffToken']>>;
}

export interface EnsureAuthorizedUserFailure {
  success: false;
  error: string;
  requiresSubscription?: boolean;
}

export type EnsureAuthorizedUserResult =
  | EnsureAuthorizedUserSuccess
  | EnsureAuthorizedUserFailure;

export interface EnsureAuthorizedUserOptions {
  allowRequiresSubscription?: boolean;
}
