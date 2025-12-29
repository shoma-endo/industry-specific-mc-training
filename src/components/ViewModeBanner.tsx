'use client';

import React from 'react';
import { Lock, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLiffContext } from '@/components/LiffProvider';

export function ViewModeBanner() {
  const { refreshUser } = useLiffContext();
  const router = useRouter();
  const handleExitViewMode = async () => {
    document.cookie = 'owner_view_mode=; path=/; max-age=0';
    document.cookie = 'owner_view_mode_employee_id=; path=/; max-age=0';
    await refreshUser();
    router.replace('/');
    router.refresh();
  };

  return (
    <div className="fixed top-0 left-0 right-0 h-14 z-[60] flex items-center justify-center px-4 gap-4 pointer-events-none">
      {/* User Status Display */}
      <div
        className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/50 border border-slate-200/60 text-slate-500 shadow-sm backdrop-blur-md transition-colors hover:bg-slate-100/80 cursor-help"
        title="閲覧専用のため編集はできません"
      >
        <Lock size={14} className="text-slate-500" aria-hidden="true" />
        <span className="text-xs font-medium">閲覧モード</span>
      </div>

      {/* Exit Link (Return to my screen) */}
      <button
        onClick={handleExitViewMode}
        aria-label="閲覧モードを終了して自分の画面に戻る"
        className="pointer-events-auto flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors bg-white/50 hover:bg-white/80 px-3 py-1.5 rounded-md backdrop-blur-sm border border-transparent hover:border-slate-200"
      >
        <ArrowLeft size={14} />
        <span className="underline underline-offset-2">自分の画面へ戻る</span>
      </button>
    </div>
  );
}
