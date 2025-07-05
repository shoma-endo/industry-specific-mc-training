export const ERROR_MESSAGES = {
  ad_acquisition:
    'SEMrushから広告情報の取得に失敗しました。しばらく時間をおいてから再度お試しください。',
  ad_not_found: 'この検索キーワードでは広告情報が見つかりませんでした。',
};

// AI モデル設定
interface ModelConfig {
  maxTokens: number;
  temperature: number;
  actualModel: string;
  seed?: number;
  top_p?: number;
}

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2': {
    maxTokens: 1500,
    temperature: 0.3,  // Claude推奨値に調整
    actualModel: 'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2',
    seed: 42,          // 再現性向上
    top_p: 0.95,       // Claude準拠
  },
  ad_copy_creation: {
    maxTokens: 1500,
    temperature: 0.3,  // Claude推奨値に調整
    actualModel: 'gpt-4.1-nano-2025-04-14',
    seed: 42,          // 再現性向上
    top_p: 0.95,       // Claude準拠
  },
  'gpt-4.1-nano-2025-04-14': {
    maxTokens: 1500,
    temperature: 0.3,  // Claude推奨値に調整
    actualModel: 'gpt-4.1-nano-2025-04-14',
    seed: 42,
    top_p: 0.95,
  },
  lp_draft_creation: {
    maxTokens: 7000,
    temperature: 0.25, // より低温度でClaudeに近づける
    actualModel: 'gpt-4.1-nano-2025-04-14',
    seed: 42,
    top_p: 0.95,
  },
  brief_creation: {
    maxTokens: 1000,
    temperature: 0.4,  // 創造性と一貫性のバランス
    actualModel: 'gpt-4.1-nano-2025-04-14',
    seed: 42,
    top_p: 0.95,
  },
};
