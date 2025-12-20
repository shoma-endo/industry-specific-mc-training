/**
 * ユーザー定義カテゴリ
 */
export interface ContentCategory {
  id: string;
  user_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * カテゴリ作成/更新用ペイロード
 */
export interface ContentCategoryPayload {
  name: string;
  color?: string;
  sort_order?: number;
}

/**
 * コンテンツ×カテゴリ紐付け
 */
export interface AnnotationCategoryLink {
  id: string;
  annotation_id: string;
  category_id: string;
  created_at?: string;
}

/**
 * カテゴリフィルター設定（localStorage用）
 */
export interface CategoryFilterConfig {
  selectedCategoryIds: string[];
  includeUncategorized: boolean;
}

/**
 * カテゴリ付きアノテーション情報
 */
export interface AnnotationWithCategories {
  annotationId: string;
  categories: ContentCategory[];
}

/**
 * デフォルトカテゴリカラーパレット
 */
export const CATEGORY_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280', // gray
] as const;

export const DEFAULT_CATEGORY_COLOR = '#6b7280';
