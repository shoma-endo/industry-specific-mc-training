'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { upsertContentAnnotation } from '@/server/handler/actions/wordpress.action';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

type Props = {
  wpPostId: number;
  canonicalUrl?: string | null;
  initial?: {
    main_kw?: string | null;
    kw?: string | null;
    impressions?: string | null;
    persona?: string | null;
    needs?: string | null;
    goal?: string | null;
  };
};

export default function AnnotationEditButton({ wpPostId, canonicalUrl, initial }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveDone, setSaveDone] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');
  const [form, setForm] = React.useState({
    main_kw: initial?.main_kw ?? '',
    kw: initial?.kw ?? '',
    impressions: initial?.impressions ?? '',
    persona: initial?.persona ?? '',
    needs: initial?.needs ?? '',
    goal: initial?.goal ?? '',
  });

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setErrorMsg('');
      const res = await upsertContentAnnotation({
        wp_post_id: wpPostId,
        canonical_url: canonicalUrl || null,
        main_kw: form.main_kw,
        kw: form.kw,
        impressions: form.impressions,
        persona: form.persona,
        needs: form.needs,
        goal: form.goal,
      });
      if ((res as { success?: boolean }).success) {
        setSaveDone(true);
        setTimeout(() => {
          setOpen(false);
          router.refresh();
          setSaveDone(false);
        }, 900);
      } else {
        setErrorMsg((res as { error?: string }).error || '保存に失敗しました');
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
          <div className="bg-white w-full max-w-2xl p-4 rounded shadow text-left">
            <h3 className="text-lg font-semibold mb-3">メモ・補足情報を編集</h3>
            {errorMsg && (
              <div className="mb-3 p-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded">
                {errorMsg}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">主軸kw</label>
                <textarea
                  className="w-full border p-2 rounded"
                  rows={2}
                  value={form.main_kw}
                  onChange={e => setForm(s => ({ ...s, main_kw: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">kw（参考）</label>
                <textarea
                  className="w-full border p-2 rounded"
                  rows={2}
                  value={form.kw}
                  onChange={e => setForm(s => ({ ...s, kw: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">表示回数</label>
                <textarea
                  className="w-full border p-2 rounded"
                  rows={2}
                  value={form.impressions}
                  onChange={e => setForm(s => ({ ...s, impressions: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">デモグラ・ペルソナ</label>
                <textarea
                  className="w-full border p-2 rounded"
                  rows={3}
                  value={form.persona}
                  onChange={e => setForm(s => ({ ...s, persona: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">ニーズ</label>
                <textarea
                  className="w-full border p-2 rounded"
                  rows={3}
                  value={form.needs}
                  onChange={e => setForm(s => ({ ...s, needs: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">ゴール</label>
                <textarea
                  className="w-full border p-2 rounded"
                  rows={3}
                  value={form.goal}
                  onChange={e => setForm(s => ({ ...s, goal: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
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
