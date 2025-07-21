import {
  ISubscriptionService,
  SubscriptionStatus,
  SubscriptionDetails,
} from '../interfaces/ISubscriptionService';
import { getUserSubscription } from '@/server/handler/actions/subscription.actions';

export class SubscriptionService implements ISubscriptionService {
  private cachedSubscription: SubscriptionDetails | null = null;
  private lastCheckTime: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分

  async checkSubscription(accessToken: string): Promise<SubscriptionStatus> {
    try {
      const result = await getUserSubscription(accessToken);

      if (!result.success) {
        return {
          hasActiveSubscription: false,
          requiresSubscription: true,
          error: result.error as string | undefined,
        };
      }

      // エラーまたは未加入
      if (result.error || result.requiresSubscription) {
        return {
          hasActiveSubscription: false,
          requiresSubscription: result.requiresSubscription || true,
          error: result.error as string | undefined,
        };
      }

      // 有効なサブスクリプションがある場合
      if (result.hasActiveSubscription && result.subscription) {
        const subscription: SubscriptionDetails = {
          id: result.subscription.id,
          status: result.subscription.status as 'active' | 'canceled' | 'past_due' | 'trialing',
          cancelAtPeriodEnd: result.subscription.cancelAtPeriodEnd,
          currentPeriodEnd: new Date(result.subscription.currentPeriodEnd * 1000),
        };

        // キャッシュ更新
        this.cachedSubscription = subscription;
        this.lastCheckTime = Date.now();

        const isActiveOrTrialing = subscription.status === 'active' || subscription.status === 'trialing';

        if (!isActiveOrTrialing || subscription.cancelAtPeriodEnd) {
          let detailedError = 'チャット機能のご利用には、有効なサブスクリプションが必要です。';

          if (subscription.cancelAtPeriodEnd && isActiveOrTrialing) {
            detailedError = 'サブスクリプションは解約手続き済みです。現在の請求期間終了後にチャット機能はご利用いただけなくなります。';
          } else if (subscription.status === 'canceled') {
            detailedError = 'サブスクリプションはキャンセル済みです。新しいサブスクリプションにご登録ください。';
          } else if (subscription.status === 'past_due') {
            detailedError = 'お支払いが確認できませんでした。お支払い情報を更新するか、新しいサブスクリプションにご登録ください。';
          } else if (!isActiveOrTrialing) {
            detailedError = `現在のサブスクリプションステータス (${subscription.status}) ではチャット機能をご利用いただけません。`;
          }

          return {
            hasActiveSubscription: false,
            requiresSubscription: true,
            subscription,
            error: detailedError,
          };
        }

        return {
          hasActiveSubscription: true,
          requiresSubscription: false,
          subscription,
        };
      }

      return {
        hasActiveSubscription: false,
        requiresSubscription: true,
        error: 'サブスクリプション情報が不完全です。',
      };
    } catch (error) {
      console.error('サブスクリプションチェックエラー:', error);
      return {
        hasActiveSubscription: false,
        requiresSubscription: true,
        error: 'サブスクリプション情報の確認中に予期せぬエラーが発生しました。',
      };
    }
  }

  hasActiveSubscription(): boolean {
    if (!this.cachedSubscription) return false;

    const isActiveOrTrialing = 
      this.cachedSubscription.status === 'active' || 
      this.cachedSubscription.status === 'trialing';

    return isActiveOrTrialing && !this.cachedSubscription.cancelAtPeriodEnd;
  }

  getSubscriptionDetails(): SubscriptionDetails | null {
    const now = Date.now();
    
    // キャッシュが期限切れの場合はnullを返す
    if (now - this.lastCheckTime > this.CACHE_DURATION) {
      return null;
    }

    return this.cachedSubscription;
  }
}