"use server"

import { env } from "@/env"
import { StripeService } from "@/server/services/stripeService"
import { LineAuthService } from "@/server/services/lineAuthService"

const stripeService = new StripeService()
const lineAuthService = new LineAuthService()

/**
 * サブスクリプション用のチェックアウトセッションを作成するサーバーアクション
 */
export async function createSubscriptionSession(liffAccessToken: string) {
  try {
    // トークンからユーザーIDを取得
    const lineProfile = await lineAuthService.getLineProfile(liffAccessToken)
    const userId = lineProfile.userId

    // リダイレクトURL
    const host = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000"

    const successUrl = `${host}/subscription/success?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${host}/subscription/cancel`

    // Stripeチェックアウトセッション作成
    const { url, sessionId } = await stripeService.createSubscriptionCheckout({
      priceId: env.STRIPE_PRICE_ID,
      customerId: undefined, // 実際のアプリでは登録済みのカスタマーIDを使用
      successUrl,
      cancelUrl,
      metadata: userId ? { userId } : undefined,
    })

    if (!url) {
      return {
        success: false,
        error: "チェックアウトURLの作成に失敗しました",
      }
    }

    return {
      success: true,
      url,
      sessionId,
    }
  } catch (error) {
    console.error("サブスクリプション決済セッション作成エラー:", error)
    return {
      success: false,
      error: "決済処理の準備中にエラーが発生しました",
    }
  }
}

/**
 * Stripeのチェックアウトセッション詳細を取得するサーバーアクション
 */
export async function getCheckoutSessionDetails(sessionId: string) {
  try {
    const session = await stripeService.getCheckoutSession(sessionId)

    return {
      success: true,
      session,
    }
  } catch (error) {
    console.error("チェックアウトセッション取得エラー:", error)
    return {
      success: false,
      error: "セッション情報の取得に失敗しました",
    }
  }
}
