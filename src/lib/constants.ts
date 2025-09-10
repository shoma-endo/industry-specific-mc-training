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

// モデルキー解決（UI表示用/送信用ともに一貫）
export const toBlogModelKey = (step: BlogStepId) => `blog_creation_${step}` as const;

// Step7判定（canonicalUrlsの適用/表示で利用）
export const isStep7 = (stepOrModel: string) =>
  stepOrModel === 'step7' ||
  stepOrModel === 'blog_creation_step7'

// UI向けヒント/詳細/プレースホルダー（集中定義）
export const BLOG_HINTS_SHORT: Record<string, string> = {
  blog_creation: '変数: なし（ステップ選択式）',
  blog_creation_step1: '変数: なし（顕在/潜在ニーズ確認）',
  blog_creation_step2: '変数: なし（ペルソナ・デモグラ）',
  blog_creation_step3: '変数: なし（ユーザーのゴール）',
  blog_creation_step4: '変数: なし（PREP確認）',
  blog_creation_step5: '変数: なし（構成案確認）',
  blog_creation_step6: '変数: なし（書き出し案）',
  blog_creation_step7: '変数: コンテンツURL一覧（内部リンク候補）',
};

export const BLOG_HINTS_DETAIL: Record<string, string> = {
  blog_creation: '8ステップのブログ作成フローを、セカンダリのセレクトで選択して進めます。',
  blog_creation_step1: 'Step1: 想定読者の顕在ニーズ/潜在ニーズを確認し、訴求観点を整理します。',
  blog_creation_step2:
    'Step2: ペルソナ・デモグラ（属性）を確認し、文体/語彙/適切な深さを調整します。',
  blog_creation_step3: 'Step3: 読了時に達成したいユーザーのゴールを明確化します。',
  blog_creation_step4: 'Step4: PREP（結論→理由→具体例→結論）観点で主張の骨子を点検します。',
  blog_creation_step5: 'Step5: 記事の見出し/章立ての構成案を確認・微調整します。',
  blog_creation_step6: 'Step6: 導入（書き出し）案を複数パターンで検討します。',
  blog_creation_step7:
    'Step7: 本文を作成します。canonicalUrls（内部リンク候補）を変数で利用可能です。',
};

export const BLOG_PLACEHOLDERS: Record<string, string> = {
  blog_creation: '実行するステップを選択してください（入力は任意）',
  blog_creation_step1: '顕在/潜在ニーズのメモを入力してください',
  blog_creation_step2: '想定ペルソナ/デモグラのメモを入力してください',
  blog_creation_step3: 'ユーザーのゴールに関するメモを入力してください',
  blog_creation_step4: 'PREP（主張・理由・具体例・結論）の確認事項を入力してください',
  blog_creation_step5: '見出し案や章立ての希望があれば入力してください',
  blog_creation_step6: '導入文のトーン/要素を入力してください',
  blog_creation_step7: '本文作成の要件/トーンを入力してください',
};

// prompts.ts 用のテンプレ名解決
export const toTemplateName = (step: BlogStepId) => `blog_creation_${step}`;
