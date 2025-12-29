'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Copy, UserPlus, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { useLiffContext } from '@/components/LiffProvider';
import Image from 'next/image';

interface EmployeeInfo {
  id: string;
  lineDisplayName: string;
  linePictureUrl?: string;
  createdAt: number;
}

interface InvitationInfo {
  token: string;
  expiresAt: number;
  url: string;
}

interface BubbleState {
  isVisible: boolean;
  message: string;
  position: { top: number; left: number };
}

const BUBBLE_VERTICAL_OFFSET = 52;
const BUBBLE_HORIZONTAL_OFFSET = 75;

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
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [bubble, setBubble] = useState<BubbleState>({
    isVisible: false,
    message: '',
    position: { top: 0, left: 0 },
  });
  const copyButtonRef = useRef<HTMLButtonElement | null>(null);

  // ステータス取得
  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const accessToken = await getAccessToken();
      // スタッフ情報取得
      const empRes = await fetch('/api/employee', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (empRes.ok) {
        const empData = await empRes.json();
        if (empData.hasEmployee) {
          setEmployee(empData.employee);
          setInvitation(null);
          setLoading(false);
          return;
        } else {
          setEmployee(null);
        }
      } else if (empRes.status !== 404) {
        // 404以外のエラーは報告
        console.error('Failed to fetch employee:', empRes.status);
        setEmployee(null);
        toast.error('スタッフ情報の取得に失敗しました');

        // 500系エラー（サーバーエラー）の場合は処理を中断
        if (empRes.status >= 500) {
          setLoading(false);
          return;
        }
      }

      // 招待情報取得（スタッフがいない場合のみ）
      const statusRes = await fetch('/api/employee/invite/status', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.hasActiveInvitation && statusData.invitation) {
          setInvitation({
            token: statusData.invitation.token,
            expiresAt: statusData.invitation.expiresAt,
            url: statusData.invitation.url,
          });
        } else {
          setInvitation(null);
        }
      } else if (statusRes.status !== 404) {
        // 404以外のエラーは報告
        console.error('Failed to fetch invitation status:', statusRes.status);
        setInvitation(null);
        toast.error('招待ステータスの取得に失敗しました');
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
      toast.error('ステータスの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

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

  const showBubble = useCallback((message: string) => {
    if (!copyButtonRef.current) return;
    const rect = copyButtonRef.current.getBoundingClientRect();
    const containerRect =
      copyButtonRef.current.closest('[data-invite-dialog-container]')?.getBoundingClientRect() ||
      null;

    if (!containerRect) return;

    const relativeTop = rect.top - containerRect.top - BUBBLE_VERTICAL_OFFSET;
    const relativeLeft = rect.left - containerRect.left + rect.width / 2 - BUBBLE_HORIZONTAL_OFFSET;

    setBubble({
      isVisible: true,
      message,
      position: { top: relativeTop, left: relativeLeft },
    });

    setTimeout(() => {
      setBubble(prev => ({ ...prev, isVisible: false }));
    }, 3000);
  }, []);

  const createInvitation = async () => {
    setLoading(true);
    try {
      const accessToken = await getAccessToken();
      const res = await fetch('/api/employee/invite', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || '招待の作成に失敗しました');

      setInvitation({
        token: data.token ?? '',
        expiresAt: data.expiresAt,
        url: data.invitationUrl,
      });
      toast.success('招待リンクを発行しました');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '招待の作成に失敗しました';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const deleteEmployee = async () => {
    setLoading(true);
    try {
      const accessToken = await getAccessToken();
      const res = await fetch('/api/employee', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'スタッフの削除に失敗しました');
      }

      setEmployee(null);
      toast.success('スタッフを削除しました');
      await refreshUser();
      onEmployeeDeleted?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'スタッフの削除に失敗しました';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

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
                <p className="text-xs text-gray-500">
                  有効期限: {new Date(invitation.expiresAt).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">
                  招待リンクは第三者に共有しないでください。誤って共有した場合は、招待リンクを再発行してください。
                  再発行すると、以前の招待リンクは無効になります。
                </p>
              </div>
              <p className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded">
                招待リンクをスタッフの方に送ってください。
              </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 gap-4">
                <p className="text-sm text-center text-gray-600">
                  現在、スタッフは登録されていません。
                  <br />
                  招待リンクを発行して、スタッフを招待しましょう。
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

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
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
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={loading}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await deleteEmployee();
                setDeleteDialogOpen(false);
              }}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? '削除中...' : '削除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
