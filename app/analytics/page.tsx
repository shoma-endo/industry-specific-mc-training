import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  getWordPressPostsForCurrentUser,
  getContentAnnotationsForUser,
} from '@/server/handler/actions/wordpress.action';
import AnalyticsTable from '@/components/AnalyticsTable';
import { Settings } from 'lucide-react';
import type { AnnotationRecord } from '@/types/annotation';

export const dynamic = 'force-dynamic';

interface PostRow {
  id: number | string;
  date?: string | undefined;
  title?: string | undefined;
  link?: string | undefined;
  categories?: number[] | undefined;
  categoryNames?: string[] | undefined;
  excerpt?: string | undefined;
}

interface AnalyticsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const params = await searchParams;
  const pageParam = Array.isArray(params?.page) ? params?.page[0] : params?.page;
  const page = Math.max(1, parseInt(pageParam || '1', 10));
  const perPage = 100; // 1ページ最大100件（WP RESTの上限）

  let posts: PostRow[] = [];
  let annotations: AnnotationRecord[] = [];
  let total = 0;
  let totalPages = 1;
  let isError = false;
  let errorMessage: string | undefined = undefined;

  const result = await getWordPressPostsForCurrentUser(page, perPage);
  const annotationRes = await getContentAnnotationsForUser();

  isError = (result as { success?: boolean }).success === false;
  errorMessage = (result as { error?: string }).error;
  posts = (!isError ? result.data?.posts || [] : []) as PostRow[];
  annotations = (annotationRes.success ? annotationRes.data : []) as AnnotationRecord[];
  total = !isError ? result.data?.total || 0 : 0;
  totalPages = Math.max(1, Math.ceil(total / perPage));

  const hasUnlinkedAnnotations = annotations.some((a) => a && a.wp_post_id == null);
  const shouldRenderTable = posts.length > 0 || hasUnlinkedAnnotations;

  return (
    <div className="w-full px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">コンテンツ一覧</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>投稿一覧</CardTitle>
            <button
              id="analytics-field-config-trigger"
              className="inline-flex items-center gap-2 rounded-md bg-black text-white text-sm font-medium px-3 h-9 hover:bg-black/90"
            >
              <Settings className="w-4 h-4" aria-hidden />
              フィールド構成
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="text-center py-8 text-red-600">
              {errorMessage || 'エラーが発生しました'}
            </div>
          ) : shouldRenderTable ? (
            <AnalyticsTable posts={posts} annotations={annotations} />
          ) : (
            <div className="text-center py-8 text-gray-500">投稿が見つかりません</div>
          )}

          {/* ページネーション */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600">
              {total > 0 ? `全${total}件 / ${page}ページ目（${totalPages}ページ）` : ''}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="px-3" asChild disabled={page <= 1}>
                <a href={`/analytics?page=${Math.max(1, page - 1)}`}>前へ</a>
              </Button>
              <Button variant="outline" className="px-3" asChild disabled={page >= totalPages}>
                <a href={`/analytics?page=${Math.min(totalPages, page + 1)}`}>次へ</a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
