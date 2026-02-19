import AnalyticsClient from './AnalyticsClient';
import { analyticsContentService } from '@/server/services/analyticsContentService';
import { getAnnotationIdsWithUnreadSuggestions } from '@/server/actions/gscNotification.actions';

export const dynamic = 'force-dynamic';

interface AnalyticsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const params = await searchParams;
  const hasUrlFilterParams = params?.category !== undefined || params?.uncategorized !== undefined;
  const pageParam = Array.isArray(params?.page) ? params.page[0] : params?.page;
  const pageParsed = Number.parseInt(pageParam ?? '1', 10);
  const page = Number.isFinite(pageParsed) && pageParsed > 0 ? pageParsed : 1;
  const perPage = 10; // 1ページあたり10件で固定表示
  const selectedCategoryNames = Array.isArray(params?.category)
    ? params.category
    : params?.category
      ? [params.category]
      : [];
  const includeUncategorized = params?.uncategorized === '1';

  // 並列でデータ取得（一覧・未読・カテゴリ一覧）
  const [analyticsPage, unreadResult, allCategoryNames] = await Promise.all([
    analyticsContentService.getPage({
      page,
      perPage,
      selectedCategoryNames,
      includeUncategorized,
    }),
    getAnnotationIdsWithUnreadSuggestions(),
    analyticsContentService.getAvailableCategoryNames(),
  ]);
  const { items, total, totalPages, page: resolvedPage, perPage: resolvedPerPage, error } = analyticsPage;
  const currentPage = resolvedPage ?? page;
  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;
  const buildPageHref = (targetPage: number) => {
    const query = new URLSearchParams();
    query.set('page', String(targetPage));
    for (const categoryName of selectedCategoryNames) {
      const trimmed = categoryName.trim();
      if (trimmed.length > 0) {
        query.append('category', trimmed);
      }
    }
    if (includeUncategorized) {
      query.set('uncategorized', '1');
    }
    return `/analytics?${query.toString()}`;
  };
  const prevHref = buildPageHref(Math.max(1, currentPage - 1));
  const nextHref = buildPageHref(Math.min(totalPages, currentPage + 1));

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
      selectedCategoryNames={selectedCategoryNames}
      includeUncategorized={includeUncategorized}
      hasUrlFilterParams={hasUrlFilterParams}
    />
  );
}
