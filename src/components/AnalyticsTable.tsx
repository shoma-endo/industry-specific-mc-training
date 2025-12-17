'use client';

import * as React from 'react';
import FieldConfigurator from '@/components/FieldConfigurator';
import TruncatedText from '@/components/TruncatedText';
import { ANALYTICS_COLUMNS, BLOG_STEP_IDS, type BlogStepId } from '@/lib/constants';
import type { AnalyticsContentItem } from '@/types/analytics';
import { ensureAnnotationChatSession } from '@/server/actions/wordpress.actions';
import { Button } from '@/components/ui/button';
import { Loader2, Bell, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Props {
  items: AnalyticsContentItem[];
  unreadAnnotationIds?: Set<string>;
}

interface LaunchPayload {
  rowKey: string;
  sessionId?: string | null;
  annotationId?: string | null;
  wpPostId?: number | null;
  wpPostTitle?: string | null;
  canonicalUrl?: string | null;
  fallbackTitle?: string | null;
  initialStep?: BlogStepId | null;
}

interface LaunchChatButtonProps {
  label: string;
  isPending: boolean;
  onClick: () => void;
}

function LaunchChatButton({ label, isPending, onClick }: LaunchChatButtonProps) {
  return (
    <Button
      variant="default"
      size="sm"
      className="bg-green-600 hover:bg-green-700 text-white focus-visible:ring-green-400"
      onClick={onClick}
      disabled={isPending}
    >
      {isPending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          移動中...
        </>
      ) : (
        label
      )}
    </Button>
  );
}

export default function AnalyticsTable({ items, unreadAnnotationIds }: Props) {
  const router = useRouter();
  const [pendingRowKey, setPendingRowKey] = React.useState<string | null>(null);
  const columnLabelMap = React.useMemo(
    () =>
      ANALYTICS_COLUMNS.reduce<Record<string, string>>((acc, col) => {
        acc[col.id] = col.label;
        return acc;
      }, {}),
    []
  );

  const handleLaunch = React.useCallback(
    async (payload: LaunchPayload) => {
      if (pendingRowKey) return;
      const {
        rowKey,
        sessionId,
        annotationId,
        wpPostId,
        wpPostTitle,
        canonicalUrl,
        fallbackTitle,
        initialStep,
      } = payload;
      setPendingRowKey(rowKey);
      try {
        const result = await ensureAnnotationChatSession({
          sessionId: sessionId ?? null,
          annotationId: annotationId ?? null,
          wpPostId: typeof wpPostId === 'number' ? wpPostId : null,
          wpPostTitle: wpPostTitle ?? null,
          canonicalUrl: canonicalUrl ?? null,
          fallbackTitle: fallbackTitle ?? null,
        });
        if (result.success) {
          const searchParams = new URLSearchParams({ session: result.sessionId });
          if (initialStep && BLOG_STEP_IDS.includes(initialStep)) {
            searchParams.set('initialStep', initialStep);
          }
          router.push(`/chat?${searchParams.toString()}`);
        } else {
          console.error(result.error);
          alert(result.error);
        }
      } catch (error) {
        console.error('Failed to launch chat session:', error);
        alert('チャット画面への遷移に失敗しました。再度お試しください。');
      } finally {
        setPendingRowKey(null);
      }
    },
    [pendingRowKey, router]
  );

  return (
    <FieldConfigurator
      storageKey="analytics.visibleColumns"
      columns={ANALYTICS_COLUMNS}
      hideTrigger
      triggerId="analytics-field-config-trigger"
    >
      {visibleSet => (
        <div className="w-full overflow-x-auto">
          <table className="min-w-[2200px] divide-y divide-gray-200">
            <thead className="bg-gray-50 analytics-head">
              <tr>
                <th className="analytics-ops-cell px-6 py-3 text-right text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap min-w-[100px]">
                  操作
                </th>
                {visibleSet.has('main_kw') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap min-w-[180px]">
                    {columnLabelMap.main_kw}
                  </th>
                )}
                {visibleSet.has('kw') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap min-w-[180px]">
                    {columnLabelMap.kw}
                  </th>
                )}
                {visibleSet.has('impressions') && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap min-w-[120px]">
                    {columnLabelMap.impressions}
                  </th>
                )}
                {visibleSet.has('needs') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap min-w-[220px]">
                    {columnLabelMap.needs}
                  </th>
                )}
                {visibleSet.has('persona') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap min-w-[220px]">
                    {columnLabelMap.persona}
                  </th>
                )}
                {visibleSet.has('goal') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap min-w-[220px]">
                    {columnLabelMap.goal}
                  </th>
                )}
                {visibleSet.has('prep') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap min-w-[220px]">
                    {columnLabelMap.prep}
                  </th>
                )}
                {visibleSet.has('basic_structure') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap min-w-[220px]">
                    {columnLabelMap.basic_structure}
                  </th>
                )}
                {visibleSet.has('opening_proposal') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap min-w-[220px]">
                    {columnLabelMap.opening_proposal}
                  </th>
                )}
                {visibleSet.has('categories') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap min-w-[200px]">
                    {columnLabelMap.categories}
                  </th>
                )}
                {visibleSet.has('date') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap min-w-[120px]">
                    {columnLabelMap.date}
                  </th>
                )}
                {visibleSet.has('wp_post_title') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap min-w-[360px]">
                    {columnLabelMap.wp_post_title}
                  </th>
                )}
                {visibleSet.has('wp_excerpt') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap min-w-[360px]">
                    {columnLabelMap.wp_excerpt}
                  </th>
                )}
                {visibleSet.has('url') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap min-w-[300px]">
                    {columnLabelMap.url}
                  </th>
                )}
                {visibleSet.has('memo') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap min-w-[220px]">
                    {columnLabelMap.memo}
                  </th>
                )}
                {visibleSet.has('rank') && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap min-w-[100px]">
                    {columnLabelMap.rank}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map(item => {
                const annotation = item.annotation;
                const wpPostId =
                  annotation?.wp_post_id != null && Number.isFinite(annotation.wp_post_id)
                    ? annotation.wp_post_id
                    : null;
                const fallbackTitle =
                  annotation?.wp_post_title || annotation?.main_kw || 'コンテンツチャット';
                const canonicalUrl = annotation?.canonical_url ?? null;
                const updatedAt = annotation?.updated_at
                  ? new Date(annotation.updated_at).toLocaleDateString('ja-JP')
                  : null;
                const hasUnreadSuggestion = annotation?.id
                  ? (unreadAnnotationIds?.has(annotation.id) ?? false)
                  : false;

                return (
                  <tr key={item.rowKey} className="analytics-row group">
                    <td className="analytics-ops-cell px-6 py-4 whitespace-nowrap text-sm text-right">
                      <div className="flex items-center justify-end gap-2">
                        <LaunchChatButton
                          label="チャット"
                          isPending={pendingRowKey === item.rowKey}
                          onClick={() => {
                            const hasExistingBlog =
                              (canonicalUrl && canonicalUrl.trim().length > 0) ||
                              (typeof wpPostId === 'number' && Number.isFinite(wpPostId));
                            handleLaunch({
                              rowKey: item.rowKey,
                              sessionId: annotation?.session_id ?? null,
                              annotationId: annotation?.id ?? null,
                              wpPostId,
                              wpPostTitle: annotation?.wp_post_title ?? null,
                              canonicalUrl,
                              fallbackTitle,
                              initialStep: hasExistingBlog ? 'step7' : null,
                            });
                          }}
                        />
                        {annotation?.id ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                            onClick={() => {
                              const target = new URLSearchParams();
                              target.set('annotationId', annotation.id ?? '');
                              window.open(
                                `/gsc-dashboard?${target.toString()}`,
                                '_blank',
                                'noopener,noreferrer'
                              );
                            }}
                          >
                            <span className="inline-flex h-3 w-3 items-center justify-center">
                              {hasUnreadSuggestion ? (
                                <span
                                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-600 animate-pulse"
                                  title="改善提案があります"
                                >
                                  <Bell className="h-3.5 w-3.5" />
                                </span>
                              ) : (
                                <FileText className="h-3.5 w-3.5 text-gray-500" aria-hidden />
                              )}
                            </span>
                            <span>詳細</span>
                          </Button>
                        ) : null}
                      </div>
                    </td>
                    {visibleSet.has('main_kw') && (
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {annotation?.main_kw ? (
                          <TruncatedText text={annotation.main_kw} lines={2} />
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    {visibleSet.has('kw') && (
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {annotation?.kw ? <TruncatedText text={annotation.kw} lines={2} /> : '—'}
                      </td>
                    )}
                    {visibleSet.has('impressions') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {annotation?.impressions ?? '—'}
                      </td>
                    )}
                    {visibleSet.has('needs') && (
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {annotation?.needs ? (
                          <TruncatedText text={annotation.needs} lines={3} />
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    {visibleSet.has('persona') && (
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {annotation?.persona ? (
                          <TruncatedText text={annotation.persona} lines={3} />
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    {visibleSet.has('goal') && (
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {annotation?.goal ? (
                          <TruncatedText text={annotation.goal} lines={3} />
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    {visibleSet.has('prep') && (
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {annotation?.prep ? (
                          <TruncatedText text={annotation.prep} lines={3} />
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    {visibleSet.has('basic_structure') && (
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {annotation?.basic_structure ? (
                          <TruncatedText text={annotation.basic_structure} lines={3} />
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    {visibleSet.has('opening_proposal') && (
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {annotation?.opening_proposal ? (
                          <TruncatedText text={annotation.opening_proposal} lines={3} />
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    {visibleSet.has('categories') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {annotation?.wp_post_type ?? '—'}
                      </td>
                    )}
                    {visibleSet.has('date') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {updatedAt ?? '—'}
                      </td>
                    )}
                    {visibleSet.has('wp_post_title') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {annotation?.wp_post_title || '—'}
                      </td>
                    )}
                    {visibleSet.has('wp_excerpt') && (
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {annotation?.wp_excerpt ? (
                          <TruncatedText text={annotation.wp_excerpt} lines={3} />
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    {visibleSet.has('url') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                        {canonicalUrl ? (
                          <a
                            href={canonicalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            {canonicalUrl}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    {visibleSet.has('memo') && (
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {annotation?.memo ? (
                          <TruncatedText text={annotation.memo} lines={3} />
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    {visibleSet.has('rank') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        —
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </FieldConfigurator>
  );
}
