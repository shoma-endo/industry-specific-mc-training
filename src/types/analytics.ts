import type { AnnotationRecord } from '@/types/annotation';

export interface AnalyticsContentItem {
  rowKey: string;
  annotation: AnnotationRecord;
}

export interface AnalyticsContentQuery {
  page: number;
  perPage: number;
  selectedCategoryNames?: string[];
  includeUncategorized?: boolean;
}

export interface AnalyticsContentPage {
  items: AnalyticsContentItem[];
  total: number;
  totalPages: number;
  page: number;
  perPage: number;
  error?: string;
}
