import type { authMiddleware } from '@/server/middleware/auth.middleware';
import type { UserService } from '@/server/services/userService';

export type EnsureAuthorizedUserSuccess = {
  success: true;
  authResult: Awaited<ReturnType<typeof authMiddleware>>;
  user: Awaited<ReturnType<UserService['getUserFromLiffToken']>>;
};

export type EnsureAuthorizedUserFailure = {
  success: false;
  error: string;
  requiresSubscription?: boolean;
};

export type EnsureAuthorizedUserResult =
  | EnsureAuthorizedUserSuccess
  | EnsureAuthorizedUserFailure;

export type EnsureAuthorizedUserOptions = {
  allowRequiresSubscription?: boolean;
};
