"use server"

// import { LoginService } from "@/server/services/lineAuthService"
import { StripeService } from "@/server/services/stripeService"
import { env } from "@/env"
// const loginService = new LoginService()
const stripeService = new StripeService()

/**
 * サブスクリプション決済用のチェックアウトセッションを作成
 */
export const createSubscriptionCheckoutServer = async ({
  // priceId,
  customerId,
  successUrl,
  cancelUrl,
  metadata,
}: {
  // priceId: string
  customerId?: string
  successUrl: string
  cancelUrl: string
  metadata?: Record<string, string>
}): Promise<{ checkoutUrl: string; sessionId: string }> => {
  try {
    const priceId = env.STRIPE_PRICE_ID
    const { url, sessionId } = await stripeService.createSubscriptionCheckout({
      priceId,
      customerId,
      successUrl,
      cancelUrl,
      metadata,
    })

    if (!url) {
      throw new Error('チェックアウトURLの作成に失敗しました')
    }

    return { checkoutUrl: url, sessionId }
  } catch (error) {
    console.error('サブスクリプション決済処理に失敗しました:', error)
    throw new Error('決済処理に失敗しました')
  }
}

/**
 * チェックアウトセッションの情報を取得
 */
export const getCheckoutSessionServer = async (sessionId: string) => {
  try {
    return await stripeService.getCheckoutSession(sessionId)
  } catch (error) {
    console.error('チェックアウトセッション取得に失敗しました:', error)
    throw new Error('セッション情報の取得に失敗しました')
  }
}