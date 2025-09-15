import { LineAuthService, LineTokenExpiredError } from './lineAuthService';
import { StripeService } from './stripeService';
import { userRepository } from './userRepository';
import type { User, UserRole } from '@/types/user';

/**
 * ユーザーサービス: ユーザー管理と課金状態の確認機能を提供
 */
export class UserService {
  private lineAuthService: LineAuthService;
  
  // 遅延初期化でStripeServiceのインスタンスを取得
  private getStripeService() {
    return new StripeService();
  }

  constructor() {
    this.lineAuthService = new LineAuthService();
  }

  /**
   * LIFFアクセストークンからユーザー情報を取得または作成
   */
  async getUserFromLiffToken(liffAccessToken: string): Promise<User | null> {
    try {
      const lineProfile = await this.lineAuthService.getLineProfile(liffAccessToken);

      let user = await userRepository.findByLineUserId(lineProfile.userId);

      if (!user) {
        try {
          user = await userRepository.create({
            lineUserId: lineProfile.userId,
            lineDisplayName: lineProfile.displayName,
            linePictureUrl: lineProfile.pictureUrl,
            lineStatusMessage: lineProfile.statusMessage,
            stripeCustomerId: undefined,
            stripeSubscriptionId: undefined,
            role: 'user',
            lastLoginAt: Date.now(),
          });
        } catch (createError: unknown) {
          // 重複キー制約エラーの場合、再度検索を試行
          if (
            createError &&
            typeof createError === 'object' &&
            'code' in createError &&
            'details' in createError &&
            createError.code === '23505' &&
            typeof createError.details === 'string' &&
            createError.details.includes('line_user_id')
          ) {
            console.log('User creation failed due to duplicate key, attempting to find existing user');
            user = await userRepository.findByLineUserId(lineProfile.userId);
          }
          
          if (!user) {
            console.error('Error creating user:', createError);
            throw new Error('ユーザーの作成に失敗しました');
          }
        }

        if (!user) {
          throw new Error('ユーザーの作成に失敗しました');
        }
      } else {
        await userRepository.update(user.id, {
          lineDisplayName: lineProfile.displayName,
          linePictureUrl: lineProfile.pictureUrl,
          lineStatusMessage: lineProfile.statusMessage,
          lastLoginAt: Date.now(),
        });
      }

      return user;
    } catch (error) {
      // LineTokenExpiredErrorの場合は、そのままthrowして上位で処理させる
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
          // トークンリフレッシュを試行
          const refreshResult = await this.lineAuthService.verifyLineTokenWithRefresh(
            liffAccessToken,
            refreshToken
          );

          if (refreshResult.isValid && refreshResult.newAccessToken) {
            // 新しいアクセストークンでユーザー情報を再取得
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
      
      // その他のエラーまたはリフレッシュトークンがない場合
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
    try {
      // userRepository にIDでユーザーを検索するメソッドがあると仮定
      const user = await userRepository.findById(id);
      return user;
    } catch (error) {
      console.error(`Failed to get user by ID (${id}) in userService:`, error);
      // エラーをスローするか、nullを返すかは設計次第
      return null; // または throw error;
    }
  }

  /**
   * Stripeカスタマー作成時にユーザー情報を更新
   */
  async updateStripeCustomerId(lineUserId: string, stripeCustomerId: string): Promise<boolean> {
    return userRepository.updateStripeCustomerId(lineUserId, stripeCustomerId);
  }

  /**
   * Stripeサブスクリプション作成時にユーザー情報を更新
   */
  async updateStripeSubscriptionId(
    lineUserId: string,
    stripeSubscriptionId: string
  ): Promise<boolean> {
    return userRepository.updateStripeSubscriptionId(lineUserId, stripeSubscriptionId);
  }

  async updateFullName(userId: string, fullName: string): Promise<boolean> {
    return userRepository.updateFullName(userId, fullName);
  }

  async getAllUsers(): Promise<User[]> {
    return userRepository.getAllUsers();
  }

  /**
   * ユーザーの権限を更新
   */
  async updateUserRole(userId: string, newRole: UserRole): Promise<boolean> {
    return userRepository.updateUserRole(userId, newRole);
  }
}

export const userService = new UserService();
