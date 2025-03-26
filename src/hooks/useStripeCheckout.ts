"use client";

import { useState } from "react";
import { createSubscriptionCheckoutServer } from "@/server/handler/actions/stripe.actions";

interface UseStripeCheckoutOptions {
  userId?: string;
  successUrl: string;
  cancelUrl: string;
}

export function useStripeCheckout({ successUrl, cancelUrl }: UseStripeCheckoutOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      // Stripe Checkoutセッションを作成
      const { checkoutUrl } = await createSubscriptionCheckoutServer({
        successUrl,
        cancelUrl,
      });

      // Stripeのチェックアウトページへリダイレクト
      window.location.href = checkoutUrl;
    } catch (err) {
      console.error("決済処理中にエラーが発生しました:", err);
      setError("決済処理中にエラーが発生しました。後でもう一度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  return {
    startCheckout,
    loading,
    error
  };
} 