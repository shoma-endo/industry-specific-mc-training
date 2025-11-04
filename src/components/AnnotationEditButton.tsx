'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  upsertContentAnnotation,
  upsertContentAnnotationBySession,
} from '@/server/handler/actions/wordpress.action';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { AnnotationFields } from '@/types/annotation';
import AnnotationFormFields from '@/components/AnnotationFormFields';
import { useAnnotationForm } from '@/hooks/useAnnotationForm';

interface Props {
  wpPostId?: number; // 紐付け済み投稿に対する編集
  sessionId?: string; // 未紐付け（セッション基点）に対する編集
  canonicalUrl?: string | null;
  initial?: AnnotationFields;
  initialWpPostTitle?: string | null;
  onOpen?: () => void;
  onClose?: () => void;
  disabled?: boolean;
}

export default function AnnotationEditButton({
  wpPostId,
  sessionId,
  canonicalUrl,
  initial,
  initialWpPostTitle,
  onOpen,
  onClose,
  disabled = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const {
    form,
    updateField,
    canonicalUrl: canonicalUrlInput,
    updateCanonicalUrl,
    canonicalUrlError,
    isSaving,
    saveDone,
    wpPostTitle,
    submit,
  } = useAnnotationForm({
    initialFields: initial ?? null,
    initialCanonicalUrl: canonicalUrl ?? null,
    initialWpPostTitle: initialWpPostTitle ?? null,
    onSubmit: ({ fields, canonicalUrl }) => {
      if (sessionId) {
        return upsertContentAnnotationBySession({
          session_id: sessionId,
          ...fields,
          canonical_url: canonicalUrl,
        });
      }
      if (typeof wpPostId === 'number') {
        return upsertContentAnnotation({
          wp_post_id: wpPostId,
          canonical_url: canonicalUrl,
          ...fields,
        });
      }
      return Promise.resolve({ success: false, error: '保存対象が特定できません' });
    },
  });

  const onOpenRef = React.useRef(onOpen);
  const onCloseRef = React.useRef(onClose);

  React.useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!open) return;
    onOpenRef.current?.();
    return () => {
      onCloseRef.current?.();
    };
  }, [open]);

  const handleSave = async () => {
    const result = await submit();
    if (result.success) {
      setTimeout(() => {
        setOpen(false);
        router.refresh();
      }, 900);
    }
  };

  return (
    <>
      <Button
        variant="default"
        size="sm"
        className="bg-green-600 hover:bg-green-700 text-white focus-visible:ring-green-400"
        onClick={() => {
          if (disabled) return;
          setOpen(true);
        }}
        disabled={disabled}
        aria-disabled={disabled}
      >
        編集
      </Button>
      {open && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 text-left">
          <div className="bg-white w-full max-w-[682px] max-h-[85vh] p-4 rounded shadow text-left flex flex-col overflow-hidden -translate-y-[20px]">
            <h3 className="text-lg font-semibold mb-3 shrink-0">メモ・補足情報を編集</h3>
            <div className="overflow-y-auto pr-1 -mr-1 flex-1 pb-6">
              <AnnotationFormFields
                form={form}
                onFormChange={updateField}
                canonicalUrl={canonicalUrlInput}
                onCanonicalUrlChange={updateCanonicalUrl}
                canonicalUrlError={canonicalUrlError}
                wpPostTitle={wpPostTitle}
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
