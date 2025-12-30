'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Copy, UserPlus, UserX, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { useLiffContext } from '@/components/LiffProvider';
import Image from 'next/image';
import { useEmployeeInvitation } from '@/hooks/useEmployeeInvitation';
import { useCopyBubble } from '@/hooks/useCopyBubble';
import { DeleteEmployeeDialog } from '@/components/DeleteEmployeeDialog';

interface InviteDialogProps {
  trigger?: React.ReactNode;
  onEmployeeDeleted?: () => void;
  defaultOpenMode?: 'invite' | 'delete';
}

export function InviteDialog({
  trigger,
  onEmployeeDeleted,
  defaultOpenMode = 'invite',
}: InviteDialogProps) {
  const { getAccessToken, refreshUser } = useLiffContext();
  const [isOpen, setIsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { employee, invitation, loading, fetchStatus, createInvitation, deleteEmployee } =
    useEmployeeInvitation({
      getAccessToken,
      refreshUser,
      ...(onEmployeeDeleted ? { onEmployeeDeleted } : {}),
    });

  const { bubble, copyButtonRef, showBubble } = useCopyBubble();

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    // defaultOpenModeが'delete'の場合は招待ダイアログをスキップして削除ダイアログを開く
    if (defaultOpenMode === 'delete') {
      setDeleteDialogOpen(true);
      setIsOpen(false);
      return;
    }
    fetchStatus();
  }, [defaultOpenMode, isOpen, fetchStatus]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" className="w-full flex items-center justify-center gap-2">
              <UserPlus size={16} />
              スタッフを招待
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>スタッフ管理</DialogTitle>
            <DialogDescription>
              スタッフを1名招待できます。スタッフが登録されると、あなたのアカウントは「閲覧権限」になり、日々の業務ツールの利用はできなくなりますが、スタッフの画面を閲覧できるようになります。
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 relative" data-invite-dialog-container>
            {bubble.isVisible && (
              <div
                className="absolute z-50 px-3 py-2 text-sm font-medium text-white rounded-lg shadow-lg transition-all duration-300 ease-in-out transform bg-green-600 animate-bounce-in"
                style={{
                  top: `${bubble.position.top}px`,
                  left: `${bubble.position.left}px`,
                  minWidth: '150px',
                  minHeight: '40px',
                  textAlign: 'center',
                  whiteSpace: 'pre-line',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-live="polite"
                role="status"
              >
                {bubble.message}
              </div>
            )}
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : employee ? (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg flex items-center gap-3">
                  {employee.linePictureUrl ? (
                    <Image
                      src={employee.linePictureUrl}
                      alt="Avatar"
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-gray-500 text-xs">No Img</span>
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-sm">{employee.lineDisplayName}</p>
                    <p className="text-xs text-gray-500">
                      登録日: {new Date(employee.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                    className="gap-2"
                  >
                    <UserX size={14} />
                    スタッフを削除
                  </Button>
                </div>
              </div>
            ) : invitation ? (
              <React.Fragment>
                <div className="space-y-4">
                  <div className="grid w-full gap-2">
                    <Label htmlFor="link">招待リンク</Label>
                    <div className="flex items-center gap-2">
                      <Input id="link" defaultValue={invitation.url} readOnly className="flex-1" />
                      <Button
                        ref={copyButtonRef}
                        size="icon"
                        variant="outline"
                        onClick={() => {
                          window.navigator.clipboard
                            .writeText(invitation.url)
                            .then(() => {
                              showBubble('✅ コピーしました');
                            })
                            .catch(error => {
                              console.error('Failed to copy:', error);
                              toast.error('コピーに失敗しました');
                            });
                        }}
                      >
                        <Copy size={16} />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    有効期限: {new Date(invitation.expiresAt).toLocaleString()}
                  </p>
                </div>
                <p className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded mt-4">
                  招待リンクをスタッフの方に送ってください。
                </p>
                <p className="text-xs text-gray-500 mt-3">
                  招待リンクは第三者に共有しないでください。誤って共有した場合は、招待リンクを再発行してください。
                  再発行すると、以前の招待リンクは無効になります。
                </p>
                <div className="flex justify-end mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={createInvitation}
                    disabled={loading}
                    className="gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        再発行中...
                      </>
                    ) : (
                      <>
                        <RotateCw size={14} />
                        招待リンクを再発行
                      </>
                    )}
                  </Button>
                </div>
              </React.Fragment>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 gap-4">
                <p className="text-sm text-center text-gray-600">
                  現在スタッフは登録されていません。
                  <br />
                  招待リンクを発行してスタッフを招待しましょう。
                </p>
                <Button
                  onClick={createInvitation}
                  className="w-full bg-[#06c755] hover:bg-[#05b34c]"
                >
                  <UserPlus size={16} className="mr-2" />
                  招待リンクを発行する
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DeleteEmployeeDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onDelete={deleteEmployee}
        loading={loading}
      />
    </>
  );
}
