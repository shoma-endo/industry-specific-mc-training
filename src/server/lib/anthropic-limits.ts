/**
 * Anthropic API レートリミット対応
 *
 * 公式ドキュメント: https://docs.anthropic.com/en/api/rate-limits
 *
 * OTPM (Output Tokens Per Minute) 制限:
 * - 標準モデル (Sonnet 4.x): 8,000 OTPM（Tier 1-4 共通）
 * - 長文脈モデル (1M context, Tier 4+): 200,000 OTPM
 *
 * 注: Tier 1-4 は月間支出上限の層であり、標準モデルの OTPM 制限は変わらない
 */

/**
 * 標準モデル（Sonnet 4.x）の OTPM 制限
 * Tier 1-4 で共通の値
 */
const STANDARD_MODEL_OTPM_LIMIT = 8000;

/**
 * 長文出力が必要なモデルキー（制限を適用しない）
 * - これらのモデルは全文出力が必要なため、max_tokens を制限しない
 * - 代わりにリクエスト頻度の調整でレートリミット対策を行う
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
 * 標準モデルの OTPM 制限を取得
 */
export function getOtpmLimit(): number {
  return STANDARD_MODEL_OTPM_LIMIT;
}

/**
 * 指定された maxTokens を OTPM 制限内に収める
 *
 * @param requestedMaxTokens - リクエストされた max_tokens 値
 * @param modelKey - モデルキー（長文出力モデルの判定に使用）
 * @returns 制限を超えない max_tokens 値（長文出力モデルは制限なし）
 */
export function clampMaxTokens(requestedMaxTokens: number, modelKey?: string): number {
  // 長文出力が必要なモデルは制限しない
  if (modelKey && LONG_OUTPUT_MODELS.has(modelKey)) {
    return requestedMaxTokens;
  }

  return Math.min(requestedMaxTokens, STANDARD_MODEL_OTPM_LIMIT);
}
