'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
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
    <div className="bg-amber-100 border-b border-amber-200 p-2 px-4 flex items-center justify-between text-amber-900 shadow-sm z-[60] fixed top-0 left-0 right-0 pointer-events-auto">
      <div className="flex items-center gap-3">
        <AlertTriangle size={20} className="text-amber-600" />
        <span className="text-sm font-medium">
          閲覧モードです。ツールの操作はできません。
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExitViewMode}
          className="text-amber-800 hover:bg-amber-200 hover:text-amber-900 gap-1 h-8"
        >
          <ArrowLeft size={14} />
          <span className="text-xs">自分の画面へ戻る</span>
        </Button>
      </div>
    </div>
  );
}
