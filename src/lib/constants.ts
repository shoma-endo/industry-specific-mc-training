export const ERROR_MESSAGES = {
  ad_acquisition:
    'SEMrushから広告情報の取得に失敗しました。しばらく時間をおいてから再度お試しください。',
  ad_not_found: 'この検索キーワードでは広告情報が見つかりませんでした。',
};

// AI モデル設定
export const MODEL_CONFIGS: Record<
  string,
  { maxTokens: number; temperature: number; actualModel: string }
> = {
  'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2': {
    maxTokens: 1500,
    temperature: 0.4,
    actualModel: 'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2',
  },
  ad_copy_creation: {
    maxTokens: 1500,
    temperature: 0.6,
    actualModel: 'gpt-4.1-nano-2025-04-14',
  },
  'gpt-4.1-nano-2025-04-14': {
    maxTokens: 1500,
    temperature: 0.6,
    actualModel: 'gpt-4.1-nano-2025-04-14',
  },
  lp_draft_creation: {
    maxTokens: 5000,
    temperature: 0.6,
    actualModel: 'gpt-4.1-nano-2025-04-14',
  },
};
