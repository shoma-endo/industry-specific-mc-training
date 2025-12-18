'use client';

import * as React from 'react';
import FieldConfigurator from '@/components/FieldConfigurator';
import TruncatedText from '@/components/TruncatedText';
import AnnotationFormFields from '@/components/AnnotationFormFields';
import { ANALYTICS_COLUMNS, BLOG_STEP_IDS, type BlogStepId } from '@/lib/constants';
import type { AnalyticsContentItem } from '@/types/analytics';
import {
  ensureAnnotationChatSession,
  updateContentAnnotationFields,
  deleteContentAnnotation,
} from '@/server/actions/wordpress.actions';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Loader2, Bell, FileText, Edit, Trash2, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ANNOTATION_FIELD_KEYS, type AnnotationFieldKey } from '@/types/annotation';
import { DeleteChatDialog } from '@/components/DeleteChatDialog';
import { ChatService } from '@/domain/services/chatService';
import { useLiffContext } from '@/components/LiffProvider';

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
  const { getAccessToken } = useLiffContext();
  const [pendingRowKey, setPendingRowKey] = React.useState<string | null>(null);
  const [editingRowKey, setEditingRowKey] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<Record<AnnotationFieldKey, string>>(() =>
    ANNOTATION_FIELD_KEYS.reduce<Record<AnnotationFieldKey, string>>(
      (acc, key) => {
        acc[key] = '';
        return acc;
      },
      {} as Record<AnnotationFieldKey, string>
    )
  );
  const [canonicalUrl, setCanonicalUrl] = React.useState('');
  const [canonicalUrlError, setCanonicalUrlError] = React.useState('');
  const [formError, setFormError] = React.useState('');
  const [wpPostTitle, setWpPostTitle] = React.useState('');
  const [isPendingEdit, startEditTransition] = React.useTransition();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deletingRowKey, setDeletingRowKey] = React.useState<string | null>(null);
  const [deleteTargetTitle, setDeleteTargetTitle] = React.useState('');
  const [deleteTargetSessionId, setDeleteTargetSessionId] = React.useState<string | null>(null);
  const [deleteTargetAnnotationId, setDeleteTargetAnnotationId] = React.useState<string | null>(
    null
  );
  const [hasOrphanContent, setHasOrphanContent] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const chatServiceRef = React.useRef<ChatService | null>(null);
  const [opsWidth, setOpsWidth] = React.useState<number>(() => {
    if (typeof window === 'undefined') return 240;
    const saved = localStorage.getItem('analytics.opsWidth');
    const num = saved ? Number(saved) : NaN;
    if (Number.isFinite(num)) return Math.min(180, Math.max(120, num)); // 幅を縮小

    return 140; // デフォルト幅を縮小
  });
  const columnLabelMap = React.useMemo(
    () =>
      ANALYTICS_COLUMNS.reduce<Record<string, string>>((acc, col) => {
        acc[col.id] = col.label;
        return acc;
      }, {}),
    []
  );

  // ChatService の初期化
  React.useEffect(() => {
    if (!chatServiceRef.current) {
      const service = new ChatService();
      service.setAccessTokenProvider(getAccessToken);
      chatServiceRef.current = service;
    }
  }, [getAccessToken]);

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

  const startResize = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = opsWidth;

      const onMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const next = Math.min(180, Math.max(120, startWidth + delta));
        setOpsWidth(next);
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp, { once: true });
    },
    [opsWidth]
  );

  const openEdit = React.useCallback((item: AnalyticsContentItem) => {
    const annotation = item.annotation;
    const nextForm = ANNOTATION_FIELD_KEYS.reduce<Record<AnnotationFieldKey, string>>(
      (acc, key) => {
        acc[key] = annotation?.[key] ? String(annotation[key] ?? '') : '';
        return acc;
      },
      {} as Record<AnnotationFieldKey, string>
    );
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
      ANNOTATION_FIELD_KEYS.reduce<Record<AnnotationFieldKey, string>>(
        (acc, key) => {
          acc[key] = '';
          return acc;
        },
        {} as Record<AnnotationFieldKey, string>
      )
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

  const handleDeleteClick = React.useCallback((item: AnalyticsContentItem) => {
    const annotation = item.annotation;
    const sessionId = annotation?.session_id;
    const annotationId = annotation?.id;

    if (!sessionId && !annotationId) {
      toast.error('削除対象のIDが見つかりません');
      return;
    }

    const title = annotation?.wp_post_title || annotation?.main_kw || 'コンテンツ';
    setDeleteTargetTitle(title);
    setDeleteTargetSessionId(sessionId ?? null);
    setDeleteTargetAnnotationId(annotationId ?? null);
    setHasOrphanContent(!sessionId);
    setDeletingRowKey(item.rowKey);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = React.useCallback(async () => {
    setIsDeleting(true);
    const toastId = toast.loading('削除中です...');

    try {
      if (deleteTargetSessionId && chatServiceRef.current) {
        // session_id がある場合: チャットとコンテンツを削除
        await chatServiceRef.current.deleteSession(deleteTargetSessionId);
      } else if (deleteTargetAnnotationId) {
        // session_id がない場合: コンテンツのみ削除
        const accessToken = await getAccessToken();
        const result = await deleteContentAnnotation(deleteTargetAnnotationId, accessToken);
        if (!result.success) {
          throw new Error(result.error || 'コンテンツの削除に失敗しました');
        }
      } else {
        throw new Error('削除対象のIDが見つかりません');
      }

      toast.success('削除しました', { id: toastId });
      setDeleteDialogOpen(false);
      setDeleteTargetSessionId(null);
      setDeleteTargetAnnotationId(null);
      setDeleteTargetTitle('');
      setHasOrphanContent(false);
      setDeletingRowKey(null);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : '削除に失敗しました';
      toast.error(message, { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTargetSessionId, deleteTargetAnnotationId, getAccessToken, router]);

  return (
    <>
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
                    className="analytics-ops-cell px-6 py-3 text-center text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap relative"
                    style={{
                      width: `${opsWidth}px`,
                      minWidth: `${opsWidth}px`,
                      maxWidth: `${opsWidth}px`,
                    }}
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
                        className="analytics-ops-cell px-2 py-4 whitespace-nowrap text-sm text-center relative"
                        style={{
                          width: `${opsWidth}px`,
                          minWidth: `${opsWidth}px`,
                          maxWidth: `${opsWidth}px`,
                        }}
                      >
                        <div className="flex items-center justify-center gap-2">
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

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                <Settings className="h-4 w-4" />
                                <span className="sr-only">メニューを開く</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(item)}>
                                <Edit className="mr-2 h-4 w-4" />
                                編集
                              </DropdownMenuItem>
                              {annotation?.id ? (
                                <DropdownMenuItem
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
                                  {hasUnreadSuggestion ? (
                                    <Bell className="mr-2 h-4 w-4 text-amber-600 animate-pulse" />
                                  ) : (
                                    <FileText className="mr-2 h-4 w-4" />
                                  )}
                                  詳細
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                onClick={() => handleDeleteClick(item)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                削除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

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
                            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>コンテンツ情報を編集</DialogTitle>
                                <DialogDescription>
                                  テーブルの各フィールドを直接編集し、保存できます。
                                </DialogDescription>
                              </DialogHeader>

                              {formError ? (
                                <Alert variant="destructive" className="mb-4">
                                  <AlertTitle className="text-sm font-semibold">
                                    保存に失敗しました
                                  </AlertTitle>
                                  <AlertDescription className="text-sm">
                                    {formError}
                                  </AlertDescription>
                                </Alert>
                              ) : null}

                              <AnnotationFormFields
                                form={form}
                                onFormChange={(key, value) =>
                                  setForm(prev => ({ ...prev, [key]: value }))
                                }
                                canonicalUrl={canonicalUrl}
                                onCanonicalUrlChange={value => {
                                  setCanonicalUrl(value);
                                  if (canonicalUrlError) setCanonicalUrlError('');
                                }}
                                canonicalUrlError={canonicalUrlError}
                                wpPostTitle={wpPostTitle}
                              />

                              <DialogFooter>
                                <Button
                                  variant="ghost"
                                  onClick={closeEdit}
                                  disabled={isPendingEdit}
                                >
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
                                <td
                                  key={id}
                                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                                >
                                  {annotation?.wp_post_type ?? '—'}
                                </td>
                              );
                            case 'date':
                              return (
                                <td
                                  key={id}
                                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                                >
                                  {updatedAt ?? '—'}
                                </td>
                              );
                            case 'wp_post_title':
                              return (
                                <td
                                  key={id}
                                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                                >
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
                                <td
                                  key={id}
                                  className="px-6 py-4 whitespace-nowrap text-sm text-blue-600"
                                >
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
      <DeleteChatDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        chatTitle={deleteTargetTitle}
        isDeleting={isDeleting}
        mode="content"
        hasOrphanContent={hasOrphanContent}
      />
    </>
  );
}
