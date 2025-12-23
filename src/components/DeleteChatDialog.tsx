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
import { Trash2 } from 'lucide-react';
import { DeleteChatDialogProps } from '@/types/components';

export function DeleteChatDialog({
  open,
  onOpenChange,
  onConfirm,
  chatTitle,
  isDeleting = false,
  mode = 'chat',
  hasOrphanContent = false,
}: DeleteChatDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const isContentMode = mode === 'content';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-500" />
            {isContentMode ? 'コンテンツを削除' : 'チャットを削除'}
          </DialogTitle>
          <DialogDescription className="text-left">
            「{chatTitle}」を削除してもよろしいですか？
            <br />
            <span className="text-red-600 font-medium">この操作は取り消すことができません。</span>
            <div className="mt-3 text-xs text-gray-600 space-y-1">
              {isContentMode ? (
                hasOrphanContent ? (
                  <p className="text-amber-600 font-medium">
                    ・紐づくチャットがないため、コンテンツのみ削除されます。
                  </p>
                ) : (
                  <>
                    <p className="text-red-600 font-medium">
                      ・このコンテンツに紐づくチャットも同時に削除されます。
                    </p>
                    <p>・チャットメッセージもすべて削除されます。</p>
                  </>
                )
              ) : (
                <>
                  <p className="text-red-600 font-medium">
                    ・このチャットに紐づくコンテンツ情報も同時に削除されます。
                  </p>
                  <p>・チャットメッセージもすべて削除されます。</p>
                </>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            キャンセル
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? '削除中...' : '削除'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
