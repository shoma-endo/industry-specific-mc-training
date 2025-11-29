// Google Search Console evaluation interval configuration
// Default: 30 days (per product spec). Future-proofed for per-user overrides.

const DEFAULT_INTERVAL_DAYS = 30;

/**
 * 評価間隔(日)を環境変数から取得する。
 * 未設定・不正値はデフォルト(30日)にフォールバックし、最小1日に丸める。
 */
export function getGscEvaluationIntervalDays(): number {
  const raw = process.env.GSC_EVALUATION_INTERVAL_DAYS;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_INTERVAL_DAYS;
  }

  return parsed;
}

/**
 * 将来のユーザー別設定対応を見越して、呼び出し側で統一的に使う設定オブジェクト。
 */
export function getGscEvaluationConfig() {
  return {
    intervalDays: getGscEvaluationIntervalDays(),
  } as const;
}

export const GSC_EVALUATION_DEFAULT_INTERVAL = DEFAULT_INTERVAL_DAYS;
