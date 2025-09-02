import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getWordPressPostsForCurrentUser } from '@/server/handler/actions/wordpress.action';

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

  const result = await getWordPressPostsForCurrentUser(page, perPage);

  const isError: boolean = (result as { success?: boolean }).success === false;
  const errorMessage: string | undefined = (result as { error?: string }).error;
  const posts: PostRow[] = (!isError ? result.data?.posts || [] : []) as PostRow[];
  const total = !isError ? result.data?.total || 0 : 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

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
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      主軸kw
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      kw（参考）
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      表示回数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      カテゴリ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      公開日
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      タイトル
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      URL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      メモ
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      順位
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {posts.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">—</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">—</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        —
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">—</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        —
                      </td>
                    </tr>
                  ))}
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
