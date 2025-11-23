'use client';

import * as React from 'react';
import FieldConfigurator from '@/components/FieldConfigurator';
import TruncatedText from '@/components/TruncatedText';
import { ANALYTICS_COLUMNS, BLOG_STEP_IDS, type BlogStepId } from '@/lib/constants';
import type { AnalyticsContentItem } from '@/types/analytics';
import { ensureAnnotationChatSession } from '@/server/handler/actions/wordpress.action';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Props {
  items: AnalyticsContentItem[];
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

export default function AnalyticsTable({ items }: Props) {
  const router = useRouter();
  const [pendingRowKey, setPendingRowKey] = React.useState<string | null>(null);

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
                <th className="analytics-ops-cell px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[100px]">
                  操作
                </th>
                {visibleSet.has('main_kw') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[180px]">
                    主軸kw
                  </th>
                )}
                {visibleSet.has('kw') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[180px]">
                    kw（参考）
                  </th>
                )}
                {visibleSet.has('impressions') && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[120px]">
                    表示回数
                  </th>
                )}
                {visibleSet.has('needs') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[220px]">
                    ニーズ
                  </th>
                )}
                {visibleSet.has('persona') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[220px]">
                    デモグラ・ペルソナ
                  </th>
                )}
                {visibleSet.has('goal') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[220px]">
                    ゴール
                  </th>
                )}
                {visibleSet.has('prep') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[220px]">
                    PREP
                  </th>
                )}
                {visibleSet.has('basic_structure') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[220px]">
                    基本構成
                  </th>
                )}
                {visibleSet.has('opening_proposal') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[220px]">
                    書き出し案
                  </th>
                )}
                {visibleSet.has('categories') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[200px]">
                    カテゴリ
                  </th>
                )}
                {visibleSet.has('date') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[120px]">
                    更新日
                  </th>
                )}
                {visibleSet.has('wp_post_title') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[360px]">
                    タイトル
                  </th>
                )}
                {visibleSet.has('url') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[300px]">
                    URL
                  </th>
                )}
                {visibleSet.has('memo') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[220px]">
                    メモ
                  </th>
                )}
                {visibleSet.has('rank') && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[100px]">
                    順位
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

                return (
                  <tr key={item.rowKey} className="analytics-row group">
                    <td className="analytics-ops-cell px-6 py-4 whitespace-nowrap text-sm text-right">
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
                          className="ml-2"
                          onClick={() => {
                            const target = new URLSearchParams();
                            target.set('annotationId', annotation.id ?? '');
                            router.push(`/gsc-dashboard?${target.toString()}`);
                          }}
                        >
                          詳細
                        </Button>
                      ) : null}
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
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {annotation?.kw ? (
                          <TruncatedText text={annotation.kw} lines={2} />
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    {visibleSet.has('impressions') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {annotation?.impressions ?? '—'}
                      </td>
                    )}
                    {visibleSet.has('needs') && (
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {annotation?.needs ? (
                          <TruncatedText text={annotation.needs} lines={3} />
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    {visibleSet.has('persona') && (
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {annotation?.persona ? (
                          <TruncatedText text={annotation.persona} lines={3} />
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    {visibleSet.has('goal') && (
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {annotation?.goal ? (
                          <TruncatedText text={annotation.goal} lines={3} />
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    {visibleSet.has('prep') && (
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {annotation?.prep ? (
                          <TruncatedText text={annotation.prep} lines={3} />
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    {visibleSet.has('basic_structure') && (
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {annotation?.basic_structure ? (
                          <TruncatedText text={annotation.basic_structure} lines={3} />
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    {visibleSet.has('opening_proposal') && (
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {annotation?.opening_proposal ? (
                          <TruncatedText text={annotation.opening_proposal} lines={3} />
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    {visibleSet.has('categories') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {annotation?.wp_post_type ?? '—'}
                      </td>
                    )}
                    {visibleSet.has('date') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {updatedAt ?? '—'}
                      </td>
                    )}
                    {visibleSet.has('wp_post_title') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {annotation?.wp_post_title || '（未紐付け）'}
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
                      <td className="px-6 py-4 text-sm text-gray-500">
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
