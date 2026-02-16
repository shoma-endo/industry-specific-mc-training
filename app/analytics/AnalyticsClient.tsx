'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import AnalyticsTable from '@/components/AnalyticsTable';
import { Download, Settings, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorAlert } from '@/components/ErrorAlert';
import type { AnalyticsContentItem } from '@/types/analytics';

interface AnalyticsClientProps {
  items: AnalyticsContentItem[];
  unreadAnnotationIds: string[];
  error?: string | null;
  total: number;
  totalPages: number;
  currentPage: number;
  perPage: number;
  prevHref: string;
  nextHref: string;
  prevDisabled: boolean;
  nextDisabled: boolean;
}

export default function AnalyticsClient({
  items,
  unreadAnnotationIds,
  error,
  total,
  totalPages,
  currentPage,
  perPage,
  prevHref,
  nextHref,
  prevDisabled,
  nextDisabled,
}: AnalyticsClientProps) {
  const unreadAnnotationSet = React.useMemo(
    () => new Set(unreadAnnotationIds),
    [unreadAnnotationIds]
  );
  const shouldRenderTable = items.length > 0;

  return (
    <div className="w-full px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">コンテンツ一覧</h1>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>投稿一覧</CardTitle>
            <button
              id="analytics-field-config-trigger"
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'h-9 inline-flex items-center gap-2 px-3 border-primary text-primary hover:bg-primary/10'
              )}
            >
              <Settings className="w-4 h-4" aria-hidden />
              フィールド構成
            </button>
            <Link
              href="/wordpress-import"
              className={cn(buttonVariants(), 'h-9 inline-flex items-center gap-2')}
            >
              <Download className="w-4 h-4" aria-hidden />
              <span>WordPress記事一括インポート</span>
            </Link>
            <Link
              href="/gsc-import"
              className={cn(buttonVariants(), 'h-9 inline-flex items-center gap-2')}
            >
              <BarChart3 className="w-4 h-4" aria-hidden />
              <span>Google Search Console 日次指標インポート</span>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="mb-4">
              <ErrorAlert error={error} variant="default" />
            </div>
          ) : null}
          {shouldRenderTable ? (
            <AnalyticsTable
              items={items}
              unreadAnnotationIds={unreadAnnotationSet}
            />
          ) : error ? null : (
            <div className="text-center py-8 text-gray-500">投稿が見つかりません</div>
          )}

          {/* ページネーション */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600">
              {total > 0 ? `全${total}件 / ${currentPage}ページ目（${totalPages}ページ） / 1ページ${perPage}件` : ''}
            </div>
            <div className="flex gap-2">
              <Link
                href={prevHref}
                prefetch={false}
                aria-disabled={prevDisabled}
                tabIndex={prevDisabled ? -1 : undefined}
                className={cn(
                  buttonVariants({ variant: 'outline' }),
                  'px-3',
                  prevDisabled && 'pointer-events-none opacity-50'
                )}
              >
                前へ
              </Link>
              <Link
                href={nextHref}
                prefetch={false}
                aria-disabled={nextDisabled}
                tabIndex={nextDisabled ? -1 : undefined}
                className={cn(
                  buttonVariants({ variant: 'outline' }),
                  'px-3',
                  nextDisabled && 'pointer-events-none opacity-50'
                )}
              >
                次へ
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
