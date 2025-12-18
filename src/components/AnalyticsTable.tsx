'use client';

import * as React from 'react';
import FieldConfigurator from '@/components/FieldConfigurator';
import TruncatedText from '@/components/TruncatedText';
import AnnotationFormFields from '@/components/AnnotationFormFields';
import { ANALYTICS_COLUMNS, BLOG_STEP_IDS, type BlogStepId } from '@/lib/constants';
import type { AnalyticsContentItem } from '@/types/analytics';
import { ensureAnnotationChatSession, updateContentAnnotationFields } from '@/server/actions/wordpress.actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Bell, FileText, Edit } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ANNOTATION_FIELD_KEYS, type AnnotationFieldKey } from '@/types/annotation';

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
  const [editingRowKey, setEditingRowKey] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<Record<AnnotationFieldKey, string>>(
    () =>
      ANNOTATION_FIELD_KEYS.reduce<Record<AnnotationFieldKey, string>>((acc, key) => {
        acc[key] = '';
        return acc;
      }, {} as Record<AnnotationFieldKey, string>)
  );
  const [canonicalUrl, setCanonicalUrl] = React.useState('');
  const [canonicalUrlError, setCanonicalUrlError] = React.useState('');
  const [formError, setFormError] = React.useState('');
  const [wpPostTitle, setWpPostTitle] = React.useState('');
  const [isPendingEdit, startEditTransition] = React.useTransition();
  const [opsWidth, setOpsWidth] = React.useState<number>(() => {
    if (typeof window === 'undefined') return 240;
    const saved = localStorage.getItem('analytics.opsWidth');
    const num = saved ? Number(saved) : NaN;
    if (Number.isFinite(num)) return Math.min(320, Math.max(200, num));

    // ビューポート幅に応じたデフォルト幅
    const vw = window.innerWidth;
    if (vw < 1366) return 200;      // 13インチ級
    if (vw < 1680) return 240;      // 14-15インチ級
    return 280;                      // 16インチ級以上
  });
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

  // 操作列リサイズ: マウスドラッグで幅を更新（最小140px 最大260px）
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('analytics.opsWidth', String(opsWidth));
  }, [opsWidth]);

  const startResize = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = opsWidth;

    const onMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const next = Math.min(320, Math.max(200, startWidth + delta));
      setOpsWidth(next);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
  }, [opsWidth]);

  const openEdit = React.useCallback((item: AnalyticsContentItem) => {
    const annotation = item.annotation;
    const nextForm = ANNOTATION_FIELD_KEYS.reduce<Record<AnnotationFieldKey, string>>((acc, key) => {
      acc[key] = annotation?.[key] ? String(annotation[key] ?? '') : '';
      return acc;
    }, {} as Record<AnnotationFieldKey, string>);
    setForm(nextForm);
    setCanonicalUrl(annotation?.canonical_url ?? '');
    setWpPostTitle(annotation?.wp_post_title ?? '');
    setFormError('');
    setCanonicalUrlError('');
    setEditingRowKey(item.rowKey);
  }, []);

  const closeEdit = React.useCallback(() => {
    setEditingRowKey(null);
    setForm(
      ANNOTATION_FIELD_KEYS.reduce<Record<AnnotationFieldKey, string>>((acc, key) => {
        acc[key] = '';
        return acc;
      }, {} as Record<AnnotationFieldKey, string>)
    );
    setCanonicalUrl('');
    setCanonicalUrlError('');
    setFormError('');
    setWpPostTitle('');
  }, []);

  const handleSave = React.useCallback(
    (annotationId: string | null | undefined) => {
      if (!annotationId) {
        setFormError('アノテーションIDが取得できません');
        return;
      }

      startEditTransition(async () => {
        setFormError('');
        const toastId = toast.loading('保存中です...');
        try {
          const result = await updateContentAnnotationFields(annotationId, {
            ...form,
            canonical_url: canonicalUrl || null,
          });

          if (result.success) {
            toast.success('保存しました', { id: toastId });
            closeEdit();
            router.refresh();
          } else {
            const message = result.error || '保存に失敗しました';
            toast.error(message, { id: toastId });
            setFormError(message);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'エラーが発生しました';
          toast.error(message, { id: toastId });
          setFormError(message);
        }
      });
    },
    [canonicalUrl, closeEdit, form, router]
  );

  return (
    <FieldConfigurator
      storageKey="analytics.visibleColumns"
      columns={ANALYTICS_COLUMNS}
      hideTrigger
      triggerId="analytics-field-config-trigger"
    >
      {({ visibleSet, orderedIds }) => (
        <div className="w-full overflow-x-auto">
          <table className="min-w-[2200px] divide-y divide-gray-200">
            <thead className="bg-gray-50 analytics-head">
              <tr>
                <th
                  className="analytics-ops-cell px-6 py-3 text-right text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap relative"
                  style={{ width: `${opsWidth}px`, minWidth: `${opsWidth}px`, maxWidth: `${opsWidth}px` }}
                >
                  操作
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none"
                    onMouseDown={startResize}
                    title="ドラッグして操作列の幅を変更"
                  />
                </th>
                {orderedIds
                  .filter(id => visibleSet.has(id))
                  .map(id => (
                    <th
                      key={id}
                      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap ${
                        id === 'impressions' ? 'text-right min-w-[120px]' : ''
                      } ${id === 'categories' ? 'min-w-[200px]' : ''} ${
                        id === 'wp_post_title' || id === 'wp_excerpt' ? 'min-w-[360px]' : ''
                      } ${id === 'url' ? 'min-w-[300px]' : ''} ${
                        ['main_kw', 'kw'].includes(id) ? 'min-w-[180px]' : ''
                      } ${['needs', 'persona', 'goal', 'prep', 'basic_structure', 'opening_proposal'].includes(id) ? 'min-w-[220px]' : ''} ${
                        id === 'date' ? 'min-w-[120px]' : ''
                      }`}
                    >
                      {columnLabelMap[id]}
                    </th>
                  ))}
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
                const rowCanonicalUrl = annotation?.canonical_url ?? null;
                const updatedAt = annotation?.updated_at
                  ? new Date(annotation.updated_at).toLocaleDateString('ja-JP')
                  : null;
                const hasUnreadSuggestion = annotation?.id
                  ? (unreadAnnotationIds?.has(annotation.id) ?? false)
                  : false;

                return (
                  <tr key={item.rowKey} className="analytics-row group">
                    <td
                      className="analytics-ops-cell pl-2 pr-3 py-4 whitespace-nowrap text-sm text-right relative"
                      style={{ width: `${opsWidth}px`, minWidth: `${opsWidth}px`, maxWidth: `${opsWidth}px` }}
                    >
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
                              canonicalUrl: rowCanonicalUrl,
                              fallbackTitle,
                              initialStep: hasExistingBlog ? 'step7' : null,
                            });
                          }}
                        />
                        <Dialog
                          open={editingRowKey === item.rowKey}
                          onOpenChange={open => {
                            if (open) {
                              openEdit(item);
                            } else {
                              closeEdit();
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="flex items-center gap-2">
                              <Edit className="h-4 w-4" />
                              編集
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>コンテンツ情報を編集</DialogTitle>
                              <DialogDescription>
                                テーブルの各フィールドを直接編集し、保存できます。
                              </DialogDescription>
                            </DialogHeader>

                            {formError ? (
                              <Alert variant="destructive" className="mb-4">
                                <AlertTitle className="text-sm font-semibold">保存に失敗しました</AlertTitle>
                                <AlertDescription className="text-sm">{formError}</AlertDescription>
                              </Alert>
                            ) : null}

                            <AnnotationFormFields
                              form={form}
                              onFormChange={(key, value) => setForm(prev => ({ ...prev, [key]: value }))}
                              canonicalUrl={canonicalUrl}
                              onCanonicalUrlChange={value => {
                                setCanonicalUrl(value);
                                if (canonicalUrlError) setCanonicalUrlError('');
                              }}
                              canonicalUrlError={canonicalUrlError}
                              wpPostTitle={wpPostTitle}
                            />

                            <DialogFooter>
                              <Button variant="ghost" onClick={closeEdit} disabled={isPendingEdit}>
                                キャンセル
                              </Button>
                              <Button
                                onClick={() => handleSave(annotation?.id)}
                                disabled={isPendingEdit}
                              >
                                {isPendingEdit ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    保存中...
                                  </>
                                ) : (
                                  '保存'
                                )}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
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
                    {orderedIds
                      .filter(id => visibleSet.has(id))
                      .map(id => {
                        switch (id) {
                          case 'main_kw':
                            return (
                              <td key={id} className="px-6 py-4 text-sm text-gray-900">
                                {annotation?.main_kw ? (
                                  <TruncatedText text={annotation.main_kw} lines={2} />
                                ) : (
                                  '—'
                                )}
                              </td>
                            );
                          case 'kw':
                            return (
                              <td key={id} className="px-6 py-4 text-sm text-gray-900">
                                {annotation?.kw ? (
                                  <TruncatedText text={annotation.kw} lines={2} />
                                ) : (
                                  '—'
                                )}
                              </td>
                            );
                          case 'impressions':
                            return (
                              <td
                                key={id}
                                className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right"
                              >
                                {annotation?.impressions ?? '—'}
                              </td>
                            );
                          case 'needs':
                            return (
                              <td key={id} className="px-6 py-4 text-sm text-gray-900">
                                {annotation?.needs ? (
                                  <TruncatedText text={annotation.needs} lines={3} />
                                ) : (
                                  '—'
                                )}
                              </td>
                            );
                          case 'persona':
                            return (
                              <td key={id} className="px-6 py-4 text-sm text-gray-900">
                                {annotation?.persona ? (
                                  <TruncatedText text={annotation.persona} lines={3} />
                                ) : (
                                  '—'
                                )}
                              </td>
                            );
                          case 'goal':
                            return (
                              <td key={id} className="px-6 py-4 text-sm text-gray-900">
                                {annotation?.goal ? (
                                  <TruncatedText text={annotation.goal} lines={3} />
                                ) : (
                                  '—'
                                )}
                              </td>
                            );
                          case 'prep':
                            return (
                              <td key={id} className="px-6 py-4 text-sm text-gray-900">
                                {annotation?.prep ? (
                                  <TruncatedText text={annotation.prep} lines={3} />
                                ) : (
                                  '—'
                                )}
                              </td>
                            );
                          case 'basic_structure':
                            return (
                              <td key={id} className="px-6 py-4 text-sm text-gray-900">
                                {annotation?.basic_structure ? (
                                  <TruncatedText text={annotation.basic_structure} lines={3} />
                                ) : (
                                  '—'
                                )}
                              </td>
                            );
                          case 'opening_proposal':
                            return (
                              <td key={id} className="px-6 py-4 text-sm text-gray-900">
                                {annotation?.opening_proposal ? (
                                  <TruncatedText text={annotation.opening_proposal} lines={3} />
                                ) : (
                                  '—'
                                )}
                              </td>
                            );
                          case 'categories':
                            return (
                              <td key={id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {annotation?.wp_post_type ?? '—'}
                              </td>
                            );
                          case 'date':
                            return (
                              <td key={id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {updatedAt ?? '—'}
                              </td>
                            );
                          case 'wp_post_title':
                            return (
                              <td key={id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {annotation?.wp_post_title || '—'}
                              </td>
                            );
                          case 'wp_excerpt':
                            return (
                              <td key={id} className="px-6 py-4 text-sm text-gray-900">
                                {annotation?.wp_excerpt ? (
                                  <TruncatedText text={annotation.wp_excerpt} lines={3} />
                                ) : (
                                  '—'
                                )}
                              </td>
                            );
                          case 'url':
                            return (
                              <td key={id} className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                                {rowCanonicalUrl ? (
                                  <a
                                    href={rowCanonicalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline"
                                  >
                                    {rowCanonicalUrl}
                                  </a>
                                ) : (
                                  '—'
                                )}
                              </td>
                            );
                          default:
                            return null;
                        }
                      })}
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
