import { LineAuthService, LineTokenExpiredError } from './lineAuthService';
import { StripeService } from './stripeService';
import { SupabaseService } from './supabaseService';
import type { SupabaseResult } from './supabaseService';
import type { User, UserRole } from '@/types/user';
import { toDbUser, toUser, type DbUser } from '@/types/user';

/**
 * ユーザーサービス: ユーザー管理と課金状態の確認機能を提供
 */
export class UserService {
  private lineAuthService: LineAuthService;
  private supabaseService: SupabaseService;

  // 遅延初期化でStripeServiceのインスタンスを取得
  private getStripeService() {
    return new StripeService();
  }

  constructor() {
    this.lineAuthService = new LineAuthService();
    this.supabaseService = new SupabaseService();
  }

  private unwrapResult<T>(result: SupabaseResult<T>): T {
    if (!result.success) {
      throw new Error(result.error.developerMessage ?? result.error.userMessage);
    }
    return result.data;
  }

  private buildDbUserUpdates(
    updates: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>,
    timestamp = Date.now()
  ): Partial<DbUser> {
    const dbUpdates: Partial<DbUser> = {
      updated_at: timestamp,
    };

    if (updates.lineDisplayName !== undefined) {
      dbUpdates.line_display_name = updates.lineDisplayName;
    }
    if (updates.linePictureUrl !== undefined) {
      dbUpdates.line_picture_url = updates.linePictureUrl;
    }
    if (updates.lineStatusMessage !== undefined) {
      dbUpdates.line_status_message = updates.lineStatusMessage;
    }
    if (updates.stripeCustomerId !== undefined) {
      dbUpdates.stripe_customer_id = updates.stripeCustomerId;
    }
    if (updates.stripeSubscriptionId !== undefined) {
      dbUpdates.stripe_subscription_id = updates.stripeSubscriptionId;
    }
    if (updates.lastLoginAt !== undefined) {
      dbUpdates.last_login_at = updates.lastLoginAt;
    }
    if (updates.fullName !== undefined) {
      dbUpdates.full_name = updates.fullName;
    }
    if (updates.role !== undefined) {
      dbUpdates.role = updates.role;
    }

    return dbUpdates;
  }

  /**
   * LIFFアクセストークンからユーザー情報を取得または作成
   */
  async getUserFromLiffToken(liffAccessToken: string): Promise<User | null> {
    try {
      const lineProfile = await this.lineAuthService.getLineProfile(liffAccessToken);

      const existingUserData = this.unwrapResult(
        await this.supabaseService.getUserByLineId(lineProfile.userId)
      );

      let user = existingUserData ? toUser(existingUserData) : null;

      if (!user) {
        const now = Date.now();
        const newUser: User = {
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
          lastLoginAt: now,
          lineUserId: lineProfile.userId,
          lineDisplayName: lineProfile.displayName,
          linePictureUrl: lineProfile.pictureUrl ?? undefined,
          lineStatusMessage: lineProfile.statusMessage ?? undefined,
          stripeCustomerId: undefined,
          stripeSubscriptionId: undefined,
          role: 'user',
        };

        const createResult = await this.supabaseService.createUser(toDbUser(newUser));

        if (!createResult.success) {
          if (
            createResult.error.code === '23505' &&
            typeof createResult.error.details === 'string' &&
            createResult.error.details.includes('line_user_id')
          ) {
            console.log('User creation failed due to duplicate key, attempting to find existing user');
            const retryData = this.unwrapResult(
              await this.supabaseService.getUserByLineId(lineProfile.userId)
            );
            user = retryData ? toUser(retryData) : null;
          } else {
            throw new Error(createResult.error.developerMessage ?? createResult.error.userMessage);
          }
        } else {
          user = toUser(createResult.data);
        }

        if (!user) {
          throw new Error('ユーザーの作成に失敗しました');
        }
      } else {
        const updateTimestamp = Date.now();
        const updateResult = await this.supabaseService.updateUserById(
          user.id,
          this.buildDbUserUpdates(
            {
              lineDisplayName: lineProfile.displayName,
              linePictureUrl: lineProfile.pictureUrl ?? undefined,
              lineStatusMessage: lineProfile.statusMessage ?? undefined,
              lastLoginAt: updateTimestamp,
            },
            updateTimestamp
          )
        );

        if (!updateResult.success) {
          console.error('Failed to update user profile after login:', updateResult.error);
        } else if (updateResult.data) {
          user = toUser(updateResult.data);
        } else {
          user = {
            ...user,
            lineDisplayName: lineProfile.displayName,
            linePictureUrl: lineProfile.pictureUrl ?? undefined,
            lineStatusMessage: lineProfile.statusMessage ?? undefined,
            lastLoginAt: updateTimestamp,
            updatedAt: updateTimestamp,
          };
        }
      }

      return user;
    } catch (error) {
      if (error instanceof LineTokenExpiredError) {
        throw error;
      }
      console.error('Failed to get or create user in userService:', error);
      throw error;
    }
  }

  /**
   * LIFFアクセストークンからユーザー情報を取得（リフレッシュトークン対応）
   */
  async getUserFromLiffTokenWithRefresh(
    liffAccessToken: string,
    refreshToken?: string
  ): Promise<{
    user: User | null;
    newAccessToken?: string;
    newRefreshToken?: string;
    needsReauth?: boolean;
  }> {
    try {
      const user = await this.getUserFromLiffToken(liffAccessToken);
      return { user };
    } catch (error) {
      if (error instanceof LineTokenExpiredError && refreshToken) {
        try {
          const refreshResult = await this.lineAuthService.verifyLineTokenWithRefresh(
            liffAccessToken,
            refreshToken
          );

          if (refreshResult.isValid && refreshResult.newAccessToken) {
            const user = await this.getUserFromLiffToken(refreshResult.newAccessToken);
            const returnValue: {
              user: User | null;
              newAccessToken?: string;
              newRefreshToken?: string;
              needsReauth?: boolean;
            } = { user };

            if (refreshResult.newAccessToken) {
              returnValue.newAccessToken = refreshResult.newAccessToken;
            }

            if (refreshResult.newRefreshToken) {
              returnValue.newRefreshToken = refreshResult.newRefreshToken;
            }

            return returnValue;
          } else if (refreshResult.needsReauth) {
            return { user: null, needsReauth: true };
          }
        } catch (refreshError) {
          console.error('Token refresh failed in userService:', refreshError);
          return { user: null, needsReauth: true };
        }
      }

      if (error instanceof LineTokenExpiredError) {
        return { user: null, needsReauth: true };
      }

      throw error;
    }
  }

  /**
   * アプリケーションのユーザーIDからユーザー情報を取得
   */
  async getUserById(id: string): Promise<User | null> {
    const result = await this.supabaseService.getUserById(id);

    if (!result.success) {
      console.error(`Failed to get user by ID (${id}) in userService:`, result.error);
      return null;
    }

    return result.data ? toUser(result.data) : null;
  }

  /**
   * Stripeカスタマー作成時にユーザー情報を更新
   */
  async updateStripeCustomerId(lineUserId: string, stripeCustomerId: string): Promise<boolean> {
    const result = await this.supabaseService.updateUserByLineUserId(lineUserId, {
      stripe_customer_id: stripeCustomerId,
      updated_at: Date.now(),
    });

    if (!result.success) {
      console.error('Failed to update Stripe customer ID:', result.error);
      return false;
    }

    return Boolean(result.data);
  }

  /**
   * Stripeサブスクリプション作成時にユーザー情報を更新
   */
  async updateStripeSubscriptionId(
    lineUserId: string,
    stripeSubscriptionId: string
  ): Promise<boolean> {
    const result = await this.supabaseService.updateUserByLineUserId(lineUserId, {
      stripe_subscription_id: stripeSubscriptionId,
      updated_at: Date.now(),
    });

    if (!result.success) {
      console.error('Failed to update Stripe subscription ID:', result.error);
      return false;
    }

    return true;
  }

  async updateFullName(userId: string, fullName: string): Promise<boolean> {
    const timestamp = Date.now();
    const result = await this.supabaseService.updateUserById(
      userId,
      this.buildDbUserUpdates({ fullName }, timestamp)
    );

    if (!result.success) {
      console.error('Failed to update full name:', result.error);
      return false;
    }

    return true;
  }

  async getAllUsers(): Promise<User[]> {
    const result = await this.supabaseService.getAllUsers();

    if (!result.success) {
      console.error('Failed to fetch all users:', result.error);
      return [];
    }

    return result.data.map(dbUser => toUser(dbUser));
  }

  /**
   * ユーザーの権限を更新
   */
  async updateUserRole(userId: string, newRole: UserRole): Promise<boolean> {
    const result = await this.supabaseService.updateUserRole(userId, newRole);

    if (!result.success) {
      console.error('Failed to update user role:', result.error);
      return false;
    }

    return true;
  }
}

export const userService = new UserService();
