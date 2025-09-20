/**
 * プロンプトの補足説明定数
 * DBに保存せず、UI上で説明を表示するための定数
 */

export interface PromptDescription {
  description: string;
  variables: string;
}

export const PROMPT_DESCRIPTIONS: Record<string, PromptDescription> = {
  ad_copy_creation: {
    description: 'Google広告やFacebook広告に使用する広告コピーを生成するプロンプト',
    variables: '事業者情報の基本項目（業種、サービス名、ターゲット、エリア）が自動で置換されます',
  },
  lp_draft_creation: {
    description: 'ランディングページの構成と原稿を作成するプロンプト',
    variables:
      '事業者情報に基づいて構造化されたLP原稿を生成します（ヘッダー、問題提起、解決策、特徴、実績、料金、FAQ、CTA）',
  },
  ad_copy_finishing: {
    description: 'ユーザーから入力された広告コピーを修正・改善するプロンプト',
    variables: '事業者情報の全17項目が利用可能です（基本情報、5W2H、ペルソナ、ベンチマーク）',
  },
  blog_creation: {
    description: 'ブログ（記事）の下書きを作成するプロンプト',
    variables: 'canonicalUrls（改行区切りの内部リンク候補URL一覧）が利用可能です',
  },
};

/**
 * プロンプト名から説明を取得
 */
export function getPromptDescription(name: string): PromptDescription | null {
  return PROMPT_DESCRIPTIONS[name] || null;
}

/**
 * 変数の種類別説明
 */
export const VARIABLE_TYPE_DESCRIPTIONS: Record<string, string> = {
  // 基本事業者情報
  business_type: '事業者の業種（例：美容院、税理士事務所、整体院）',
  service_name: '提供するサービス名（例：カット＆カラー、確定申告サポート）',
  target_audience: 'ターゲット顧客層（例：30代女性、中小企業経営者）',
  service_area: 'サービス提供エリア（例：東京都渋谷区、全国対応）',
  differentiation: '競合他社との差別化ポイント',

  // 詳細事業者情報（17項目）
  service: 'サービス内容の詳細説明',
  company: '会社名・屋号',
  address: '所在地（住所）',
  businessHours: '営業時間・定休日',
  tel: '電話番号',
  qualification: '保有資格・認定',
  payments: '対応決済方法',
  strength: '事業の強み・特徴',
  when: 'いつ（タイミング・期間）',
  where: 'どこで（場所・範囲）',
  who: '誰が（担当者・対象者）',
  why: 'なぜ（理由・目的）',
  what: '何を（商品・サービス内容）',
  how: 'どのように（方法・プロセス）',
  howMuch: 'いくらで（料金・費用）',
  persona: 'ペルソナ情報',
  benchmarkUrl: 'ベンチマークURL（参考サイト）',
  // ブログ作成用（内部リンク候補）
  canonicalUrls: '内部リンク候補のURL一覧（改行区切り）',
  // ブログ作成用（content_annotations 由来）
  contentNeeds: 'ユーザーのニーズ',
  contentPersona: 'デモグラ・ペルソナ',
  contentGoal: 'ユーザーのゴール',
  contentPrep: 'PREP要約',
  contentBasicStructure: '基本構成',
  contentOpeningProposal: '書き出し案',
};

/**
 * 変数説明を取得
 */
export function getVariableDescription(variableName: string): string {
  return VARIABLE_TYPE_DESCRIPTIONS[variableName] || `変数: ${variableName}`;
}
