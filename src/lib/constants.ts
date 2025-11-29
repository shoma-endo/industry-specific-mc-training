export const ERROR_MESSAGES = {
  ad_not_found: 'この検索キーワードでは広告情報が見つかりませんでした。',
  daily_chat_limit:
    '本日のチャット利用上限（3回）に達しました。上限は日本時間の00:00にリセットされます。',
};

// Chat Configuration
export const CHAT_HISTORY_LIMIT = 12;

export const GOOGLE_SEARCH_CONSOLE_SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
];

// Feature Flags
export const FEATURE_FLAGS = {
  USE_RPC_V2: process.env.FEATURE_RPC_V2 === 'true',
};

// AI モデル設定
interface ModelConfig {
  provider: 'openai' | 'anthropic';
  maxTokens: number;
  temperature: number;
  actualModel: string;
  seed?: number;
  top_p?: number;
}

// 共通設定（DRY原則に基づく定数化）
const ANTHROPIC_BASE = {
  provider: 'anthropic' as const,
  temperature: 0.3,
  actualModel: 'claude-sonnet-4-5-20250929',
  seed: 42,
};

const OPENAI_BASE = {
  provider: 'openai' as const,
  temperature: 0.3,
  seed: 42,
  top_p: 0.95,
};

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2': {
    ...OPENAI_BASE,
    maxTokens: 4500,
    actualModel: 'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2',
  },
  ad_copy_creation: { ...ANTHROPIC_BASE, maxTokens: 4500 },
  ad_copy_finishing: { ...ANTHROPIC_BASE, maxTokens: 4500 },
  lp_draft_creation: { ...ANTHROPIC_BASE, maxTokens: 15000 },
  lp_improvement: { ...ANTHROPIC_BASE, maxTokens: 12000 },
  // ブログ作成ステップ（共通設定を適用し、maxTokensのみ個別指定）
  blog_creation_step1: { ...ANTHROPIC_BASE, maxTokens: 5000 },
  blog_creation_step2: { ...ANTHROPIC_BASE, maxTokens: 5000 },
  blog_creation_step3: { ...ANTHROPIC_BASE, maxTokens: 5000 },
  blog_creation_step4: { ...ANTHROPIC_BASE, maxTokens: 5000 },
  blog_creation_step5: { ...ANTHROPIC_BASE, maxTokens: 5000 },
  blog_creation_step6: { ...ANTHROPIC_BASE, maxTokens: 5000 },
  blog_creation_step7: { ...ANTHROPIC_BASE, maxTokens: 15000 },
};

// =============================================================================
// Blog Creation Steps (centralized definitions)
// =============================================================================

export type BlogStepId = 'step1' | 'step2' | 'step3' | 'step4' | 'step5' | 'step6' | 'step7';

export const BLOG_STEP_IDS: BlogStepId[] = [
  'step1',
  'step2',
  'step3',
  'step4',
  'step5',
  'step6',
  'step7',
];

export const BLOG_STEP_LABELS: Record<BlogStepId, string> = {
  step1: '1. 顕在ニーズ・潜在ニーズ確認',
  step2: '2. ペルソナ・デモグラチェック',
  step3: '3. ユーザーのゴール',
  step4: '4. PREPチェック',
  step5: '5. 構成案確認',
  step6: '6. 書き出し案',
  step7: '7. 本文作成',
};

// Step7判定（canonicalUrlsの適用/表示で利用）
export const isStep7 = (stepOrModel: string) =>
  stepOrModel === 'step7' || stepOrModel === 'blog_creation_step7';

export const BLOG_PLACEHOLDERS: Record<string, string> = {
  blog_creation_step1: '顕在/潜在ニーズの内容を入力してください',
  blog_creation_step2: '想定ペルソナ/デモグラの内容を入力してください',
  blog_creation_step3: 'ユーザーのゴールに関する内容を入力してください',
  blog_creation_step4: 'PREP（主張・理由・具体例・結論）の確認事項を入力してください',
  blog_creation_step5: '構成案確認内容を入力してください',
  blog_creation_step6: '書き出し案を入力してください',
  blog_creation_step7: '本文作成の要件/トーンを入力してください',
};

// prompts.ts 用のテンプレ名解決
export const toTemplateName = (step: BlogStepId) => `blog_creation_${step}`;

export const ANALYTICS_COLUMNS = [
  { id: 'main_kw', label: '主軸kw' },
  { id: 'kw', label: 'kw（参考）' },
  { id: 'impressions', label: '表示回数' },
  { id: 'needs', label: 'ニーズ' },
  { id: 'persona', label: 'デモグラ・ペルソナ' },
  { id: 'goal', label: 'ゴール' },
  { id: 'prep', label: 'PREP' },
  { id: 'basic_structure', label: '基本構成' },
  { id: 'opening_proposal', label: '書き出し案' },
  { id: 'categories', label: 'カテゴリ' },
  { id: 'date', label: '公開日' },
  { id: 'wp_post_title', label: 'WordPressタイトル' },
  { id: 'ads_headline', label: '広告タイトル' },
  { id: 'ads_description', label: '広告説明文' },
  { id: 'url', label: 'URL' },
  { id: 'memo', label: 'メモ' },
  { id: 'rank', label: '順位' },
];

// ブログステップとコンテンツフィールドのマッピング
export const STEP_TO_FIELD_MAP: Record<BlogStepId, string> = {
  step1: 'needs',
  step2: 'persona',
  step3: 'goal',
  step4: 'prep',
  step5: 'basic_structure',
  step6: 'opening_proposal',
  step7: 'full', // step7は特殊（全フィールド必要）
};
