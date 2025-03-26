import Stripe from 'stripe';
import { env } from '@/env';

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
}
