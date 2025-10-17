'use client';

import React, { useState, useEffect } from 'react';
import { upsertContentAnnotationBySession } from '@/server/handler/actions/wordpress.action';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePersistedResizableWidth } from '@/hooks/usePersistedResizableWidth';
import {
  ANNOTATION_FIELD_KEYS,
  AnnotationFieldKey,
  AnnotationRecord,
} from '@/types/annotation';
import AnnotationFormFields from '@/components/AnnotationFormFields';

type AnnotationFormState = Record<AnnotationFieldKey, string>;

const EMPTY_FORM_ENTRIES = ANNOTATION_FIELD_KEYS.map(key => [key, ''] as const);
const EMPTY_FORM = Object.fromEntries(EMPTY_FORM_ENTRIES) as AnnotationFormState;

const toFormState = (data?: AnnotationRecord | null): AnnotationFormState => {
  return ANNOTATION_FIELD_KEYS.reduce(
    (acc, key) => {
      acc[key] = data?.[key] ?? '';
      return acc;
    },
    { ...EMPTY_FORM }
  );
};

type Props = {
  sessionId: string;
  initialData?: AnnotationRecord | null;
  onClose: () => void;
  isVisible?: boolean;
  onSaveSuccess?: () => void;
};

export default function AnnotationPanel({
  sessionId,
  initialData,
  onClose,
  isVisible = true,
  onSaveSuccess,
}: Props) {
  const [form, setForm] = useState<AnnotationFormState>(() => toFormState(initialData));
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveDone, setSaveDone] = React.useState(false);
  const [canonicalUrl, setCanonicalUrl] = React.useState<string>(() =>
    initialData?.canonical_url ?? ''
  );
  const [canonicalUrlError, setCanonicalUrlError] = React.useState<string>('');
  const [errorMsg, setErrorMsg] = React.useState('');

  const { width: panelWidth, isResizing, handleMouseDown } = usePersistedResizableWidth({
    storageKey: 'chat-right-panel-width',
    defaultWidth: 450,
    minWidth: 320,
    maxWidth: 1000,
  });
  useEffect(() => {
    setForm(toFormState(initialData));
    setCanonicalUrl(initialData?.canonical_url ?? '');
    setCanonicalUrlError('');
  }, [initialData]);

  const save = async () => {
    const trimmed = canonicalUrl.trim();
    setCanonicalUrlError('');
    let normalizedUrl: string | null = null;

    if (trimmed.length > 0) {
      try {
        const parsed = new URL(trimmed);
        normalizedUrl = parsed.toString();
      } catch {
        setCanonicalUrlError('有効なURLを入力してください');
        return;
      }
    }

    setErrorMsg('');
    setIsSaving(true);
    setSaveDone(false);
    try {
      const res = await upsertContentAnnotationBySession({
        session_id: sessionId,
        ...form,
        canonical_url: normalizedUrl,
      });
      if (!res.success) {
        setErrorMsg(res.error || '保存に失敗しました');
        if (res.error && normalizedUrl) {
          setCanonicalUrlError(res.error);
        }
      } else {
        setErrorMsg('');
        setSaveDone(true);
        setTimeout(() => setSaveDone(false), 900);

        const nextCanonical =
          res.canonical_url !== undefined ? res.canonical_url ?? '' : normalizedUrl ?? '';
        setCanonicalUrl(nextCanonical);
        setCanonicalUrlError('');

        // 保存成功時のコールバックを呼び出す
        onSaveSuccess?.();
      }
    } catch {
      setErrorMsg('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };
  if (!isVisible) return null;

  return (
    <div
      className={cn('h-full bg-gray-50 border-l flex flex-col relative')}
      style={{ width: panelWidth }}
    >
      {/* リサイザーハンドル - 固定ヘッダー下から開始 */}
      <div
        className={`absolute left-0 top-16 bottom-0 w-1 cursor-col-resize transition-all duration-200 group ${
          isResizing ? 'bg-blue-500 w-2 shadow-lg' : 'bg-gray-200 hover:bg-blue-300 hover:w-1.5'
        }`}
        onMouseDown={handleMouseDown}
        style={{ zIndex: 45 }} // ヘッダーより少し下のz-index
        title="ドラッグして幅を調整"
      >
        {/* リサイザーハンドルの視覚的ヒント */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-0.5 h-8 bg-white/70 rounded-full"></div>
        </div>
      </div>

      {/* ヘッダー部分 - 固定ヘッダー分のtop位置を調整 */}
      <div className="sticky top-16 z-40 flex items-center justify-between px-4 py-3 border-b bg-white/90 backdrop-blur-sm ml-2 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <h3 className="text-lg font-semibold text-gray-800">メモ・補足情報</h3>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="w-8 h-8 hover:bg-red-100 hover:text-red-600 transition-colors"
          title="パネルを閉じる"
        >
          <X size={16} />
        </Button>
      </div>

      {/* コンテンツエリア - ヘッダーとの重なりを防ぐため上部パディングを調整 */}
      <div className="flex-1 overflow-auto p-4 ml-2" style={{ paddingTop: '80px' }}>
        <div className="space-y-5">
          {errorMsg && (
            <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded">
              {errorMsg}
            </div>
          )}
          <AnnotationFormFields
            form={form}
            onFormChange={(field, value) => setForm(s => ({ ...s, [field]: value }))}
            canonicalUrl={canonicalUrl}
            onCanonicalUrlChange={value => {
              setCanonicalUrl(value);
              if (canonicalUrlError) setCanonicalUrlError('');
            }}
            canonicalUrlError={canonicalUrlError}
            canonicalUrlInputId="panel-wp-canonical-url"
          />

          {/* アクションボタン */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isSaving || saveDone}
              >
                キャンセル
              </Button>
              <div className="relative">
                <Button size="sm" onClick={save} disabled={isSaving || saveDone}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      保存中...
                    </>
                  ) : saveDone ? (
                    '保存完了'
                  ) : (
                    '保存'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
