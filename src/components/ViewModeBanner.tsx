'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useLiffContext } from '@/components/LiffProvider';

export function ViewModeBanner() {
  const { getAccessToken, refreshUser } = useLiffContext();
  const router = useRouter();
  const handleDeleteEmployee = async () => {
    if (
      !confirm(
        '本当にスタッフを削除しますか？\nスタッフのアカウントおよび関連データは完全に削除され、現在のアカウントは通常モードに戻ります。'
      )
    )
      return;

    try {
      const accessToken = await getAccessToken();
      const res = await fetch('/api/employee', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!res.ok) {
        let errorMessage = 'スタッフの削除に失敗しました';
        try {
          const data = await res.json();
          errorMessage = data.error || errorMessage;
        } catch {
          // JSON parsing failed, use default message
        }
        throw new Error(errorMessage);
      }

      toast.success('スタッフを削除しました');
      await refreshUser();
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="bg-amber-100 border-b border-amber-200 p-2 px-4 flex items-center justify-between text-amber-900 shadow-sm z-50 relative pointer-events-auto">
      <div className="flex items-center gap-3">
        <AlertTriangle size={20} className="text-amber-600" />
        <span className="text-sm font-medium">
          閲覧モードです。ツールの操作はできません。
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDeleteEmployee}
        className="text-amber-800 hover:bg-amber-200 hover:text-amber-900 gap-1 h-8"
      >
        <UserX size={14} />
        <span className="text-xs">スタッフを削除して復帰</span>
      </Button>
    </div>
  );
}
