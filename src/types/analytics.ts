import type { AnnotationRecord } from '@/types/annotation';
import type { Ga4PageMetricSummary } from '@/types/ga4';

export interface AnalyticsContentItem {
  rowKey: string;
  annotation: AnnotationRecord;
  ga4Summary?: Ga4PageMetricSummary | null;
}

export interface AnalyticsContentQuery {
  page: number;
  perPage: number;
  selectedCategoryNames?: string[];
  includeUncategorized?: boolean;
  startDate: string;
  endDate: string;
}

export interface AnalyticsContentPage {
  items: AnalyticsContentItem[];
  total: number;
  totalPages: number;
  page: number;
  perPage: number;
  error?: string | undefined;
  ga4Error?: string | undefined;
}
