"use server"

import { LoginService } from "@/server/services/lineAuthService"
import { StripeService } from "@/server/services/stripeService"

const loginService = new LoginService()
const stripeService = new StripeService()

export const verifyLineTokenServer = async (
  accessToken: string
): Promise<void> => {
  loginService.verifyLineToken(accessToken)
}

export interface getLineProfileServerResponse {
  userId: string
  displayName: string
  pictureUrl: string
  language: string
  statusMessage?: string
}

export const getLineProfileServer = async (
  accessToken: string
): Promise<getLineProfileServerResponse> => {
  const profile = await loginService.getLineProfile(accessToken)
  console.log("profile.back", profile)
  return profile
}

/**
 * サブスクリプション決済用のチェックアウトセッションを作成
 */
export const createSubscriptionCheckoutServer = async ({
  priceId,
  customerId,
  successUrl,
  cancelUrl,
  metadata,
}: {
  priceId: string
  customerId?: string
  successUrl: string
  cancelUrl: string
  metadata?: Record<string, string>
}): Promise<{ checkoutUrl: string; sessionId: string }> => {
  try {
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