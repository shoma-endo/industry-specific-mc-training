import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  getWordPressPostsForCurrentUser,
  getContentAnnotationsForUser,
} from '@/server/handler/actions/wordpress.action';
import AnnotationEditButton from '@/components/AnnotationEditButton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

type AnalyticsPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const params = await searchParams;
  const pageParam = Array.isArray(params?.page) ? params?.page[0] : params?.page;
  const page = Math.max(1, parseInt(pageParam || '1', 10));
  const perPage = 100; // 1ページ最大100件（WP RESTの上限）

  let posts: PostRow[] = [];
  let annotations: Array<{
    wp_post_id: number;
    main_kw?: string | null;
    kw?: string | null;
    impressions?: string | null;
    persona?: string | null;
    needs?: string | null;
    goal?: string | null;
    memo?: string | null;
  }> = [];
  let total = 0;
  let totalPages = 1;
  let isError = false;
  let errorMessage: string | undefined = undefined;

  const result = await getWordPressPostsForCurrentUser(page, perPage);
  const annotationRes = await getContentAnnotationsForUser();

  isError = (result as { success?: boolean }).success === false;
  errorMessage = (result as { error?: string }).error;
  posts = (!isError ? result.data?.posts || [] : []) as PostRow[];
  annotations = (annotationRes.success ? annotationRes.data : []) as Array<{
    wp_post_id: number;
    main_kw?: string | null;
    kw?: string | null;
    impressions?: string | null;
    persona?: string | null;
    needs?: string | null;
    goal?: string | null;
    memo?: string | null;
  }>;
  total = !isError ? result.data?.total || 0 : 0;
  totalPages = Math.max(1, Math.ceil(total / perPage));

  // 表示用: 改行保持しつつ複数行トリミング、ホバーで全文
  const TruncatedText = ({ text, lines = 2 }: { text: string; lines?: number }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="whitespace-pre-wrap break-words cursor-help overflow-hidden"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: lines,
              WebkitBoxOrient: 'vertical' as const,
            }}
          >
            {text}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-[520px] whitespace-pre-wrap break-words">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <div className="w-full px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">コンテンツ一覧</h1>

      <Card>
        <CardHeader>
          <CardTitle>投稿一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="text-center py-8 text-red-600">
              取得に失敗しました{errorMessage ? `: ${errorMessage}` : ''}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">投稿が見つかりません</div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="min-w-[2200px] divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[180px]">
                      主軸kw
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[180px]">
                      kw（参考）
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[120px]">
                      表示回数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[220px]">
                      デモグラ・ペルソナ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[220px]">
                      ニーズ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[220px]">
                      ゴール
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[200px]">
                      カテゴリ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[120px]">
                      公開日
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[360px]">
                      タイトル
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[300px]">
                      URL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[220px]">
                      メモ
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[100px]">
                      順位
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {posts.map(p => {
                    const a = annotations.find(
                      x => x.wp_post_id === (typeof p.id === 'string' ? parseInt(p.id, 10) : p.id)
                    );
                    return (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {a?.main_kw ? <TruncatedText text={a.main_kw} lines={2} /> : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {a?.kw ? <TruncatedText text={a.kw} lines={2} /> : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                          {a?.impressions ?? '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {a?.persona ? <TruncatedText text={a.persona} lines={3} /> : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {a?.needs ? <TruncatedText text={a.needs} lines={3} /> : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {a?.goal ? <TruncatedText text={a.goal} lines={3} /> : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {p.categoryNames && p.categoryNames.length > 0
                            ? p.categoryNames.join(', ')
                            : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {p.date ? new Date(p.date).toLocaleDateString('ja-JP') : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {p.title || '（無題）'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                          {p.link ? (
                            <a
                              href={p.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline"
                            >
                              {p.link}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {a?.memo ? <TruncatedText text={a.memo} lines={3} /> : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                          —
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <AnnotationEditButton
                            wpPostId={typeof p.id === 'string' ? parseInt(p.id, 10) : p.id}
                            canonicalUrl={p.link ?? null}
                            initial={{
                              main_kw: a?.main_kw ?? null,
                              kw: a?.kw ?? null,
                              impressions: a?.impressions ?? null,
                              persona: a?.persona ?? null,
                              needs: a?.needs ?? null,
                              goal: a?.goal ?? null,
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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

      <div className="mt-4 text-xs text-gray-500">
        インプレッション・順位・メモ・主軸kw/kw は後でGSC/カスタムフィールドを合流します。
      </div>
    </div>
  );
}
