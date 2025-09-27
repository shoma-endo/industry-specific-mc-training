export const ERROR_MESSAGES = {
  ad_not_found: 'この検索キーワードでは広告情報が見つかりませんでした。',
  daily_chat_limit:
    '本日のチャット利用上限（3回）に達しました。上限は日本時間の00:00にリセットされます。',
};

// Feature Flags
export const FEATURE_FLAGS = {
  USE_RPC_V2: process.env.FEATURE_RPC_V2 === 'true',
  USE_SERVER_COMPONENTS: process.env.FEATURE_SERVER_COMPONENTS === 'true',
  USE_DYNAMIC_IMPORTS: process.env.FEATURE_DYNAMIC_IMPORTS === 'true',
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

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2': {
    provider: 'openai',
    maxTokens: 4500,
    temperature: 0.3,
    actualModel: 'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2',
    seed: 42,
    top_p: 0.95,
  },
  ad_copy_creation: {
    provider: 'anthropic',
    maxTokens: 4500,
    temperature: 0.3,
    actualModel: 'claude-sonnet-4-20250514',
    seed: 42,
    top_p: 0.9,
  },
  ad_copy_finishing: {
    provider: 'anthropic',
    maxTokens: 4500,
    temperature: 0.3,
    actualModel: 'claude-sonnet-4-20250514',
    seed: 42,
    top_p: 0.9,
  },
  lp_draft_creation: {
    provider: 'anthropic',
    maxTokens: 15000,
    temperature: 0.3,
    actualModel: 'claude-sonnet-4-20250514',
    seed: 42,
    top_p: 0.1,
  },
  lp_improvement: {
    provider: 'anthropic',
    maxTokens: 6000,
    temperature: 0.3,
    actualModel: 'claude-sonnet-4-20250514',
    seed: 42,
    top_p: 0.9,
  },
  blog_creation_step1: {
    provider: 'anthropic',
    maxTokens: 5000,
    temperature: 0.3,
    actualModel: 'claude-sonnet-4-20250514',
    seed: 42,
    top_p: 0.1,
  },
  blog_creation_step2: {
    provider: 'anthropic',
    maxTokens: 5000,
    temperature: 0.3,
    actualModel: 'claude-sonnet-4-20250514',
    seed: 42,
    top_p: 0.1,
  },
  blog_creation_step3: {
    provider: 'anthropic',
    maxTokens: 5000,
    temperature: 0.3,
    actualModel: 'claude-sonnet-4-20250514',
    seed: 42,
    top_p: 0.1,
  },
  blog_creation_step4: {
    provider: 'anthropic',
    maxTokens: 5000,
    temperature: 0.3,
    actualModel: 'claude-sonnet-4-20250514',
    seed: 42,
    top_p: 0.1,
  },
  blog_creation_step5: {
    provider: 'anthropic',
    maxTokens: 5000,
    temperature: 0.3,
    actualModel: 'claude-sonnet-4-20250514',
    seed: 42,
    top_p: 0.1,
  },
  blog_creation_step6: {
    provider: 'anthropic',
    maxTokens: 5000,
    temperature: 0.3,
    actualModel: 'claude-sonnet-4-20250514',
    seed: 42,
    top_p: 0.1,
  },
  blog_creation_step7: {
    provider: 'anthropic',
    maxTokens: 15000,
    temperature: 0.3,
    actualModel: 'claude-sonnet-4-20250514',
    seed: 42,
    top_p: 0.1,
  },
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

// UI向けヒント/詳細/プレースホルダー（集中定義）
export const BLOG_HINTS_SHORT: Record<string, string> = {
  blog_creation: '変数: なし（ステップ選択式）',
  blog_creation_step1: '変数: ニーズ/ペルソナ/ゴール/PREP/基本構成',
  blog_creation_step2: '変数: ニーズ/ペルソナ/ゴール/PREP/基本構成',
  blog_creation_step3: '変数: ニーズ/ペルソナ/ゴール/PREP/基本構成',
  blog_creation_step4: '変数: ニーズ/ペルソナ/ゴール/PREP/基本構成',
  blog_creation_step5: '変数: ニーズ/ペルソナ/ゴール/PREP/基本構成',
  blog_creation_step6: '変数: ニーズ/ペルソナ/ゴール/PREP/基本構成',
  blog_creation_step7: '変数: ニーズ/ペルソナ/ゴール/PREP/基本構成 + コンテンツURL一覧',
};

export const BLOG_HINTS_DETAIL: Record<string, string> = {
  blog_creation: '8ステップのブログ作成フローを、セカンダリのセレクトで選択して進めます。',
  blog_creation_step1:
    'Step1: 顕在/潜在ニーズ。contentNeeds, contentPersona, contentGoal, contentPrep, contentBasicStructure を利用可能。',
  blog_creation_step2:
    'Step2: ペルソナ・デモグラ。contentNeeds, contentPersona, contentGoal, contentPrep, contentBasicStructure を利用可能。',
  blog_creation_step3:
    'Step3: ユーザーのゴール。contentNeeds, contentPersona, contentGoal, contentPrep, contentBasicStructure を利用可能。',
  blog_creation_step4:
    'Step4: PREP確認。contentNeeds, contentPersona, contentGoal, contentPrep, contentBasicStructure を利用可能。',
  blog_creation_step5:
    'Step5: 構成案確認。contentNeeds, contentPersona, contentGoal, contentPrep, contentBasicStructure を利用可能。',
  blog_creation_step6:
    'Step6: 書き出し案。contentNeeds, contentPersona, contentGoal, contentPrep, contentBasicStructure を利用可能。',
  blog_creation_step7: 'Step7: 本文作成。上記に加え canonicalUrls（内部リンク候補）も利用可能。',
};

export const BLOG_PLACEHOLDERS: Record<string, string> = {
  blog_creation_step1: '顕在/潜在ニーズの内容を入力してください',
  blog_creation_step2: '想定ペルソナ/デモグラの内容を入力してください',
  blog_creation_step3: 'ユーザーのゴールに関する内容を入力してください',
  blog_creation_step4: 'PREP（主張・理由・具体例・結論）の確認事項を入力してください',
  blog_creation_step5: '構成案確認内容を入力してください',
  blog_creation_step6: '書き出し案を入力してください',
  blog_creation_step7: '本文作成の要件/トーンを入力してください',
  revision: '全体の修正指示を入力してください',
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
  { id: 'title', label: 'タイトル' },
  { id: 'url', label: 'URL' },
  { id: 'memo', label: 'メモ' },
  { id: 'rank', label: '順位' },
];
