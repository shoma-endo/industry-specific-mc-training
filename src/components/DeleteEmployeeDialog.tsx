'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserX } from 'lucide-react';

interface DeleteEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => Promise<void>;
  loading: boolean;
}

export function DeleteEmployeeDialog({
  open,
  onOpenChange,
  onDelete,
  loading,
}: DeleteEmployeeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-red-500" />
            スタッフを削除
          </DialogTitle>
          <DialogDescription className="text-left">
            スタッフを削除してもよろしいですか？
            <br />
            <span className="text-sm text-gray-600">
              このスタッフに関連するすべてのデータ（閲覧モード含む）が完全に削除されます。
            </span>
            <br />
            <span className="text-sm text-gray-600">
              スタッフ削除後、あなたのアカウントは「有料会員」権限に戻り、通常の業務ツールを利用できるようになります。
            </span>
            <br />
            <span className="text-red-600 font-medium">この操作は取り消すことができません。</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            キャンセル
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              await onDelete();
              onOpenChange(false);
            }}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? '削除中...' : '削除'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

