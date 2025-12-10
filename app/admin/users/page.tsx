'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getAllUsers, updateUserRole } from '@/server/actions/admin.actions';
import { getRoleDisplayName } from '@/authUtils';
import type { User, UserRole } from '@/types/user';
import { clearAuthCache } from '@/server/actions/adminUsers.actions';

const formatDateTime = (timestamp: number | undefined) => {
  if (!timestamp) return '未ログイン';

  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(timestamp));
};

const getRoleColor = (role: UserRole | null) => {
  switch (role) {
    case 'admin':
      return 'bg-blue-100 text-blue-800';
    case 'trial':
      return 'bg-yellow-100 text-yellow-800';
    case 'paid':
      return 'bg-green-100 text-green-800';
    case 'unavailable':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: 'success' | 'error';
  }>({
    open: false,
    title: '',
    message: '',
    variant: 'success',
  });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const result = await getAllUsers();
        if (result.success && result.users) {
          setUsers(result.users);
        } else {
          setError(result.error || 'ユーザー一覧の取得に失敗しました');
        }
      } catch (error) {
        console.error('ユーザー一覧取得エラー:', error);
        setError('ユーザー一覧の取得中にエラーが発生しました');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (!userId || !newRole) return;

    setUpdatingUserId(userId);

    try {
      const result = await updateUserRole(userId, newRole);
      if (result.success) {
        // ローカル状態を更新
        setUsers(prevUsers =>
          prevUsers.map(user => (user.id === userId ? { ...user, role: newRole } : user))
        );
        setEditingUserId(null);

        // 成功フィードバックを表示
        setFeedback({
          open: true,
          title: 'ユーザー権限を更新しました',
          message: `新しい権限: ${getRoleDisplayName(newRole)}`,
          variant: 'success',
        });

        // キャッシュクリア通知を送信（権限変更の即座反映のため）
        await clearAuthCache();
      } else {
        setFeedback({
          open: true,
          title: '権限の更新に失敗しました',
          message: result.error || 'ユーザー権限の更新に失敗しました',
          variant: 'error',
        });
      }
    } catch (error) {
      console.error('ユーザー権限更新エラー:', error);
      setFeedback({
        open: true,
        title: '権限の更新でエラーが発生しました',
        message: 'ユーザー権限の更新中にエラーが発生しました',
        variant: 'error',
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const isFeedbackSuccess = feedback.variant === 'success';
  const roleSummary = useMemo(() => {
    type RoleCount = {
      key: UserRole | 'unknown';
      label: string;
      count: number;
    };

    const baseRoles: UserRole[] = ['admin', 'paid', 'trial', 'unavailable'];
    const counts: Record<UserRole, number> = {
      admin: 0,
      paid: 0,
      trial: 0,
      unavailable: 0,
    };
    let unknown = 0;

    users.forEach(user => {
      const role = user.role;
      if (role && role in counts) {
        counts[role] += 1;
      } else {
        unknown += 1;
      }
    });

    const summary: RoleCount[] = baseRoles.map(role => ({
      key: role,
      label: getRoleDisplayName(role),
      count: counts[role],
    }));

    if (unknown > 0) {
      summary.push({
        key: 'unknown',
        label: getRoleDisplayName(null),
        count: unknown,
      });
    }

    return summary;
  }, [users]);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">ユーザー管理</h1>
        </div>
        <div className="text-center py-8">
          <p>ユーザー一覧を読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">ユーザー管理</h1>
        </div>
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-red-600">
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">ユーザー管理</h1>
          <p className="mt-2 text-gray-600">
            登録済みユーザーの一覧を表示します（合計: {users.length}人）
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-500">
            {roleSummary.map(({ key, label, count }) => (
              <span
                key={key}
                className={`px-2 py-1 text-xs rounded-full ${getRoleColor(
                  key === 'unknown' ? null : key
                )}`}
              >
                {label}: {count}人
              </span>
            ))}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ユーザー一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>登録済みユーザーがいません</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      フルネーム
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      LINE表示名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      最終ログイン
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      登録日
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      権限
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      アクション
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.fullName || '未入力'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.lineDisplayName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTime(user.lastLoginAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTime(user.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {editingUserId === user.id ? (
                          <Select
                            value={user.role ?? 'unavailable'}
                            onValueChange={value => handleRoleChange(user.id, value as UserRole)}
                            disabled={updatingUserId === user.id}
                          >
                            <SelectTrigger size="sm" className="w-40 text-xs">
                              <SelectValue placeholder="権限を選択" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="trial">お試しユーザー</SelectItem>
                              <SelectItem value="paid">有料契約ユーザー</SelectItem>
                              <SelectItem value="admin">管理者</SelectItem>
                              <SelectItem value="unavailable">サービス利用停止</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${getRoleColor(user.role)}`}
                          >
                            {getRoleDisplayName(user.role)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {editingUserId === user.id ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => setEditingUserId(null)}
                              className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                              disabled={updatingUserId === user.id}
                            >
                              キャンセル
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingUserId(user.id)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            編集
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={feedback.open}
        onOpenChange={open => setFeedback(prev => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={isFeedbackSuccess ? 'text-green-600' : 'text-red-600'}>
              {feedback.title}
            </DialogTitle>
            <DialogDescription>{feedback.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setFeedback(prev => ({ ...prev, open: false }))}
              variant={isFeedbackSuccess ? 'default' : 'destructive'}
            >
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
