import Stripe from 'stripe';
import { env } from '@/env';
import { userService } from './userService';

export class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY);
  }

  /**
   * LineユーザーIDに基づいてStripeカスタマーを新規作成
   */
  async createCustomer(userId: string, name: string) {
    try {
      // 新規カスタマーを作成
      const customer = await this.stripe.customers.create({
        metadata: { userId },
        name,
      });

      return customer.id;
    } catch (error) {
      console.error('Stripe customer creation failed:', error);
      throw new Error('顧客情報の作成に失敗しました');
    }
  }

  /**
   * サブスクリプションをキャンセル
   * @param subscriptionId サブスクリプションID
   * @param immediate 即時解約するかどうか（trueなら即時解約、falseなら期間終了時解約）
   */
  async cancelSubscription(subscriptionId: string, immediate: boolean = false) {
    try {
      if (immediate) {
        // 即時解約
        return await this.stripe.subscriptions.cancel(subscriptionId);
      } else {
        // 期間終了時解約
        return await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
      }
    } catch (error) {
      console.error('Stripe subscription cancellation failed:', error);
      throw new Error('サブスクリプションのキャンセルに失敗しました');
    }
  }

  /**
   * サブスクリプションIDからサブスクリプション情報を取得
   * @param subscriptionId サブスクリプションID
   */
  async getSubscription(subscriptionId: string) {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      return subscription;
    } catch (error) {
      console.error('Stripe subscription retrieval failed:', error);
      throw new Error('サブスクリプション情報の取得に失敗しました');
    }
  }

  /**
   * 解約予定のサブスクリプションを継続する（解約をキャンセル）
   * @param subscriptionId サブスクリプションID
   */
  async resumeSubscription(subscriptionId: string) {
    try {
      // cancel_at_period_end を false に設定して解約をキャンセル
      return await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });
    } catch (error) {
      console.error('Stripe subscription resume failed:', error);
      throw new Error('サブスクリプションの継続手続きに失敗しました');
    }
  }

  /**
   * カスタマーポータルセッションを作成（支払い方法変更など）
   */
  async createCustomerPortalSession(customerId: string, returnUrl: string) {
    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      return { url: session.url };
    } catch (error) {
      console.error('Stripe customer portal session creation failed:', error);
      throw new Error('顧客ポータルの作成に失敗しました');
    }
  }

  /**
   * プライスIDから商品価格情報を取得
   */
  async getPriceDetails(priceId: string) {
    try {
      const price = await this.stripe.prices.retrieve(priceId, {
        expand: ['product'],
      });

      // 価格情報を整形して返す
      return {
        id: price.id,
        unitAmount: price.unit_amount,
        currency: price.currency,
        interval: price.recurring?.interval,
        intervalCount: price.recurring?.interval_count,
        productName: (price.product as Stripe.Product).name,
        productDescription: (price.product as Stripe.Product).description,
      };
    } catch (error) {
      console.error('Stripe price retrieval failed:', error);
      throw new Error('価格情報の取得に失敗しました');
    }
  }

  /**
   * サブスクリプション用のチェックアウトセッションを作成
   */
  async createSubscriptionCheckout({
    priceId,
    customerId,
    successUrl,
    cancelUrl,
    metadata = {},
  }: {
    priceId: string;
    customerId: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }) {
    try {
      const session = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer: customerId,
        metadata,
      });

      return { url: session.url, sessionId: session.id };
    } catch (error) {
      console.error('Stripe checkout session creation failed:', error);
      throw new Error('決済セッションの作成に失敗しました');
    }
  }

  /**
   * チェックアウトセッション情報を取得
   */
  async getCheckoutSession(sessionId: string) {
    return this.stripe.checkout.sessions.retrieve(sessionId);
  }

  /**
   * ユーザーIDに基づいてStripeサブスクリプションの状態を確認します。
   * @param userId アプリケーションのユーザーID
   * @returns 有効なサブスクリプションがあればtrue、なければfalseを返します。
   */
  async checkSubscriptionStatus(userId: string): Promise<boolean> {
    try {
      // 1. userId から Stripe の顧客ID (stripeCustomerId) を取得する
      //    userService を利用してアプリケーションのユーザーデータベースから取得
      const user = await userService.getUserById(userId);
      const stripeCustomerId = user?.stripeCustomerId;

      if (!stripeCustomerId) {
        console.log(`[StripeService] No Stripe Customer ID found for user: ${userId}`);
        return false;
      }

      // 2. Stripe APIを使用して、その顧客IDに関連するサブスクリプションを取得
      // まず 'active' なサブスクリプションを確認
      const activeSubscriptions = await this.stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: 'active',
        limit: 1, // 1つでもあれば十分
      });

      if (activeSubscriptions.data.length > 0) {
        console.log(`[StripeService] Active subscription found for user: ${userId}`);
        return true;
      }

      // 'active' がなければ 'trialing' なサブスクリプションを確認
      const trialingSubscriptions = await this.stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: 'trialing',
        limit: 1, // 1つでもあれば十分
      });

      if (trialingSubscriptions.data.length > 0) {
        console.log(`[StripeService] Trialing subscription found for user: ${userId}`);
        return true;
      }

      console.log(`[StripeService] No active or trialing subscription found for user: ${userId}`);
      return false;
    } catch (error) {
      console.error('[StripeService] Error checking subscription status:', error);
      // エラーが発生した場合、ユーザーは有効なサブスクリプションを持っていないとみなすのが安全
      return false;
    }
  }
}
