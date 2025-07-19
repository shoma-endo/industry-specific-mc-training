export const ERROR_MESSAGES = {
  ad_acquisition:
    'SEMrushから広告情報の取得に失敗しました。しばらく時間をおいてから再度お試しください。',
  ad_not_found: 'この検索キーワードでは広告情報が見つかりませんでした。',
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
    maxTokens: 1500,
    temperature: 0.3, // Claude推奨値に調整
    actualModel: 'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2',
    seed: 42, // 再現性向上
    top_p: 0.95, // Claude準拠
  },
  ad_copy_creation: {
    provider: 'anthropic',
    maxTokens: 1500,
    temperature: 0.3,
    actualModel: 'claude-sonnet-4-20250514',
    seed: 42,
    top_p: 0.9,
  },
  'gpt-4.1-nano': {
    provider: 'anthropic',
    maxTokens: 1500,
    temperature: 0.3,
    actualModel: 'claude-sonnet-4-20250514',
    seed: 42,
    top_p: 0.9,
  },
  lp_draft_creation: {
    provider: 'anthropic',
    maxTokens: 8000,
    temperature: 0.3,
    actualModel: 'claude-sonnet-4-20250514',
    seed: 42,
    top_p: 0.1,
  },
};
