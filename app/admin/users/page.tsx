'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { getAllUsers, updateUserRole } from '@/server/handler/actions/admin.actions';
import { getRoleDisplayName } from '@/lib/auth-utils';
import type { User, UserRole } from '@/types/user';

const formatDateTime = (timestamp: number | undefined) => {
  if (!timestamp) return '未ログイン';
  
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Tokyo'
  }).format(new Date(timestamp));
};

const getRoleColor = (role: UserRole | null) => {
  switch (role) {
    case 'admin':
      return 'bg-red-100 text-red-800';
    case 'user':
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
          prevUsers.map(user => 
            user.id === userId ? { ...user, role: newRole } : user
          )
        );
        setEditingUserId(null);
        
        // 成功アラートを表示
        alert('ユーザー権限を更新しました');
        
        // キャッシュクリア通知を送信（権限変更の即座反映のため）
        try {
          await fetch('/api/auth/clear-cache', { method: 'POST' });
        } catch (error) {
          console.warn('Cache clear failed:', error);
        }
      } else {
        alert(result.error || 'ユーザー権限の更新に失敗しました');
      }
    } catch (error) {
      console.error('ユーザー権限更新エラー:', error);
      alert('ユーザー権限の更新中にエラーが発生しました');
    } finally {
      setUpdatingUserId(null);
    }
  };

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
                  {users.map((user) => (
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
                          <select
                            className="border border-gray-300 rounded px-2 py-1 text-xs"
                            defaultValue={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                            disabled={updatingUserId === user.id}
                          >
                            <option value="user">一般ユーザー</option>
                            <option value="admin">管理者</option>
                            <option value="unavailable">サービス利用停止</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-1 text-xs rounded-full ${getRoleColor(user.role)}`}>
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
    </div>
  );
}