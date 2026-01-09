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

type AnthropicTier = '1' | '2' | '3' | '4';

/**
 * 現在の Tier（Tier変更時はここを修正）
 */
const CURRENT_TIER: AnthropicTier = '1';

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
 * 長文出力が必要なモデルキー（制限を適用しない）
 * - これらのモデルは全文出力が必要なため、max_tokens を制限しない
 * - 代わりに Canvas API の統合（3回→2回）でレートリミット対策を行う
 */
const LONG_OUTPUT_MODELS = new Set([
  'blog_creation_step7', // ブログ本文作成
  'lp_draft_creation', // LP下書き作成
  'lp_improvement', // LP改善
  'gsc_insight_ctr_boost', // GSC CTR改善
  'gsc_insight_intro_refresh', // GSC 書き出し改善
  'gsc_insight_body_rewrite', // GSC 本文改善
  'gsc_insight_persona_rebuild', // GSC ペルソナ再構築
]);

/**
 * 現在の Tier に基づいた OTPM 制限を取得
 */
export function getOtpmLimit(): number {
  return OTPM_LIMITS[CURRENT_TIER];
}

/**
 * 現在の Tier を取得
 */
export function getCurrentTier(): AnthropicTier {
  return CURRENT_TIER;
}

/**
 * 指定された maxTokens を現在の Tier の OTPM 制限内に収める
 *
 * @param requestedMaxTokens - リクエストされた max_tokens 値
 * @param modelKey - モデルキー（長文出力モデルの判定に使用）
 * @returns Tier 制限を超えない max_tokens 値（長文出力モデルは制限なし）
 */
export function clampMaxTokens(requestedMaxTokens: number, modelKey?: string): number {
  // 長文出力が必要なモデルは制限しない
  if (modelKey && LONG_OUTPUT_MODELS.has(modelKey)) {
    return requestedMaxTokens;
  }

  const otpmLimit = getOtpmLimit();
  return Math.min(requestedMaxTokens, otpmLimit);
}
