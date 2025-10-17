'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  upsertContentAnnotation,
  upsertContentAnnotationBySession,
} from '@/server/handler/actions/wordpress.action';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ANNOTATION_FIELD_KEYS, AnnotationFieldKey, AnnotationFields } from '@/types/annotation';
import AnnotationFormFields from '@/components/AnnotationFormFields';

type Props = {
  wpPostId?: number; // 紐付け済み投稿に対する編集
  sessionId?: string; // 未紐付け（セッション基点）に対する編集
  canonicalUrl?: string | null;
  initial?: AnnotationFields;
};

type AnnotationFormState = Record<AnnotationFieldKey, string>;

const EMPTY_FORM_ENTRIES = ANNOTATION_FIELD_KEYS.map(key => [key, ''] as const);
const EMPTY_FORM = Object.fromEntries(EMPTY_FORM_ENTRIES) as AnnotationFormState;

const toFormState = (fields?: AnnotationFields | null): AnnotationFormState => {
  return ANNOTATION_FIELD_KEYS.reduce(
    (acc, key) => {
      acc[key] = fields?.[key] ?? '';
      return acc;
    },
    { ...EMPTY_FORM }
  );
};

export default function AnnotationEditButton({
  wpPostId,
  sessionId,
  canonicalUrl,
  initial,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveDone, setSaveDone] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');
  const [form, setForm] = React.useState<AnnotationFormState>(() => toFormState(initial));
  const [canonicalUrlInput, setCanonicalUrlInput] = React.useState<string>(() => canonicalUrl ?? '');
  const [canonicalUrlError, setCanonicalUrlError] = React.useState('');

  React.useEffect(() => {
    setForm(toFormState(initial));
  }, [initial]);

  React.useEffect(() => {
    setCanonicalUrlInput(canonicalUrl ?? '');
    setCanonicalUrlError('');
  }, [canonicalUrl]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setErrorMsg('');
      setCanonicalUrlError('');

      const trimmed = canonicalUrlInput.trim();
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

      let res:
        | {
            success?: boolean;
            error?: string;
            canonical_url?: string | null;
            wp_post_id?: number | null;
          }
        | undefined;
      if (sessionId) {
        // セッション基点で保存（WP未紐付け）
        res = await upsertContentAnnotationBySession({
          session_id: sessionId,
          ...form,
          canonical_url: normalizedUrl,
        });
      } else if (typeof wpPostId === 'number') {
        // 紐付け済み投稿に対する保存
        res = await upsertContentAnnotation({
          wp_post_id: wpPostId,
          canonical_url: normalizedUrl,
          ...form,
        });
      } else {
        setErrorMsg('保存対象が特定できません');
        return;
      }
      if ((res as { success?: boolean }).success) {
        setSaveDone(true);
        setTimeout(() => {
          setOpen(false);
          router.refresh();
          setSaveDone(false);
          const nextCanonical =
            res?.canonical_url !== undefined ? res.canonical_url ?? '' : normalizedUrl ?? '';
          setCanonicalUrlInput(nextCanonical);
          setCanonicalUrlError('');
        }, 900);
      } else {
        setErrorMsg((res as { error?: string }).error || '保存に失敗しました');
        if (normalizedUrl) {
          setCanonicalUrlError((res as { error?: string }).error ?? '');
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Button
        variant="default"
        size="sm"
        className="bg-green-600 hover:bg-green-700 text-white focus-visible:ring-green-400"
        onClick={() => setOpen(true)}
      >
        編集
      </Button>
      {open && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 text-left">
          <div className="bg-white w-full max-w-2xl max-h-[85vh] p-4 rounded shadow text-left flex flex-col overflow-hidden -translate-y-[20px]">
            <h3 className="text-lg font-semibold mb-3 shrink-0">メモ・補足情報を編集</h3>
            {errorMsg && (
              <div className="mb-3 p-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded shrink-0">
                {errorMsg}
              </div>
            )}
            <div className="overflow-y-auto pr-1 -mr-1 flex-1 pb-6">
              <AnnotationFormFields
                form={form}
                onFormChange={(field, value) => setForm(s => ({ ...s, [field]: value }))}
                canonicalUrl={canonicalUrlInput}
                onCanonicalUrlChange={value => {
                  setCanonicalUrlInput(value);
                  if (canonicalUrlError) setCanonicalUrlError('');
                }}
                canonicalUrlError={canonicalUrlError}
                className="space-y-5"
                canonicalUrlInputId="modal-wp-canonical-url"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={isSaving || saveDone}
              >
                キャンセル
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving || saveDone}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 保存中...
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
      )}
    </>
  );
}
