import AnalyticsClient from './AnalyticsClient';
import { analyticsContentService } from '@/server/services/analyticsContentService';
import { getAnnotationIdsWithUnreadSuggestions } from '@/server/actions/gscNotification.actions';

export const dynamic = 'force-dynamic';

interface AnalyticsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const params = await searchParams;
  const pageParam = Array.isArray(params?.page) ? params?.page[0] : params?.page;
  const page = Math.max(1, parseInt(pageParam || '1', 10));
  const perPage = 10; // 1ページあたり10件で固定表示

  // 並列でデータ取得（一覧・未読・カテゴリ一覧）
  const [analyticsPage, unreadResult, allCategoryNames] = await Promise.all([
    analyticsContentService.getPage({ page, perPage }),
    getAnnotationIdsWithUnreadSuggestions(),
    analyticsContentService.getAvailableCategoryNames(),
  ]);
  const { items, total, totalPages, page: resolvedPage, perPage: resolvedPerPage, error } = analyticsPage;
  const currentPage = resolvedPage ?? page;
  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;
  const prevHref = `/analytics?page=${Math.max(1, currentPage - 1)}`;
  const nextHref = `/analytics?page=${Math.min(totalPages, currentPage + 1)}`;

  return (
    <AnalyticsClient
      items={items}
      allCategoryNames={allCategoryNames}
      unreadAnnotationIds={unreadResult.annotationIds}
      error={error ?? null}
      total={total}
      totalPages={totalPages}
      currentPage={currentPage}
      perPage={resolvedPerPage}
      prevHref={prevHref}
      nextHref={nextHref}
      prevDisabled={prevDisabled}
      nextDisabled={nextDisabled}
    />
  );
}
