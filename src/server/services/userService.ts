import { LineAuthService } from './lineAuthService';
import { StripeService } from './stripeService';
import { userRepository } from './userRepository';
import type { User } from '@/types/user';

/**
 * ユーザーサービス: ユーザー管理と課金状態の確認機能を提供
 */
export class UserService {
  private lineAuthService: LineAuthService;
  private stripeService: StripeService;

  constructor() {
    this.lineAuthService = new LineAuthService();
    this.stripeService = new StripeService();
  }

  /**
   * LIFFアクセストークンからユーザー情報を取得または作成
   */
  async getUserFromLiffToken(liffAccessToken: string): Promise<User | null> {
    try {
      const lineProfile = await this.lineAuthService.getLineProfile(liffAccessToken);

      let user = await userRepository.findByLineUserId(lineProfile.userId);

      if (!user) {
        user = await userRepository.create({
          lineUserId: lineProfile.userId,
          lineDisplayName: lineProfile.displayName,
          linePictureUrl: lineProfile.pictureUrl,
          lineStatusMessage: lineProfile.statusMessage,
        });

        if (!user) {
          throw new Error('ユーザーの作成に失敗しました');
        }
      } else {
        await userRepository.update(user.id, {
          lineDisplayName: lineProfile.displayName,
          linePictureUrl: lineProfile.pictureUrl,
          lineStatusMessage: lineProfile.statusMessage,
        });
      }

      return user;
    } catch (error) {
      console.error('Failed to get or create user:', error);
      return null;
    }
  }

  /**
   * ユーザーのサブスクリプション状態を確認
   */
  async hasActiveSubscription(liffAccessToken: string): Promise<boolean> {
    try {
      const user = await this.getUserFromLiffToken(liffAccessToken);
      if (!user || !user.stripeCustomerId) {
        return false;
      }

      const subscription = await this.stripeService.getActiveSubscription(user.stripeCustomerId);
      return !!subscription;
    } catch (error) {
      console.error('Failed to check subscription status:', error);
      return false;
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
}

export const userService = new UserService();
