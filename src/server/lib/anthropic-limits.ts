/**
 * Anthropic API レートリミット対応
 *
 * 公式ドキュメント: https://docs.anthropic.com/en/api/rate-limits
 *
 * Tier ごとの OTPM (Output Tokens Per Minute) 制限:
 * - Tier 1: 8,000 (Sonnet 4.x)
 * - Tier 2: 90,000
 * - Tier 3: 160,000
 * - Tier 4: 400,000
 */

import { env } from '@/env';

type AnthropicTier = '1' | '2' | '3' | '4';

/**
 * Tier ごとの OTPM 制限（Sonnet 4.x 基準）
 */
const OTPM_LIMITS: Record<AnthropicTier, number> = {
  '1': 8000,
  '2': 90000,
  '3': 160000,
  '4': 400000,
};

/**
 * 現在の Tier に基づいた OTPM 制限を取得
 */
export function getOtpmLimit(): number {
  const tier = env.ANTHROPIC_TIER as AnthropicTier;
  return OTPM_LIMITS[tier] ?? OTPM_LIMITS['1'];
}

/**
 * 現在の Tier を取得
 */
export function getCurrentTier(): AnthropicTier {
  return (env.ANTHROPIC_TIER as AnthropicTier) ?? '1';
}

/**
 * 指定された maxTokens を現在の Tier の OTPM 制限内に収める
 *
 * @param requestedMaxTokens - リクエストされた max_tokens 値
 * @returns Tier 制限を超えない max_tokens 値
 */
export function clampMaxTokens(requestedMaxTokens: number): number {
  const otpmLimit = getOtpmLimit();
  return Math.min(requestedMaxTokens, otpmLimit);
}
