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
  const perPage = 100; // 1ページ最大100件（WP RESTの上限）

  // 並列でデータ取得
  const [analyticsPage, unreadResult] = await Promise.all([
    analyticsContentService.getPage({ page, perPage }),
    getAnnotationIdsWithUnreadSuggestions(),
  ]);
  const { items, total, totalPages, page: resolvedPage, error } = analyticsPage;
  const currentPage = resolvedPage ?? page;
  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;
  const prevHref = `/analytics?page=${Math.max(1, currentPage - 1)}`;
  const nextHref = `/analytics?page=${Math.min(totalPages, currentPage + 1)}`;

  return (
    <AnalyticsClient
      items={items}
      unreadAnnotationIds={unreadResult.annotationIds}
      error={error ?? null}
      total={total}
      totalPages={totalPages}
      currentPage={currentPage}
      prevHref={prevHref}
      nextHref={nextHref}
      prevDisabled={prevDisabled}
      nextDisabled={nextDisabled}
    />
  );
}
