'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PromptTemplate } from '@/types/prompt';
import { deletePromptTemplate, togglePromptTemplateStatus } from '@/server/handler/actions/prompt.actions';
import { useLiffContext } from '@/components/ClientLiffProvider';
import { getPromptDescription } from '@/lib/prompt-descriptions';

interface Props {
  templates: PromptTemplate[];
  onUpdate: () => void;
}

export function PromptList({ templates, onUpdate }: Props) {
  const { getAccessToken } = useLiffContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<string | null>(null);


  const filteredTemplates = templates.filter(template => {
    const promptDescription = getPromptDescription(template.name);
    const matchesSearch = 
      template.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (promptDescription?.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && template.is_active) ||
      (statusFilter === 'inactive' && !template.is_active);

    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (id: string, displayName: string) => {
    if (!confirm(`「${displayName}」を削除しますか？この操作は取り消せません。`)) {
      return;
    }

    setIsLoading(id);
    try {
      const token = await getAccessToken();
      const result = await deletePromptTemplate(token, id);

      if (result.success) {
        onUpdate();
      } else {
        alert(`エラー: ${result.error}`);
      }
    } catch (error) {
      console.error('削除エラー:', error);
      alert('削除に失敗しました');
    } finally {
      setIsLoading(null);
    }
  };

  const handleToggleStatus = async (id: string, displayName: string, isActive: boolean) => {
    const action = isActive ? '無効化' : '有効化';
    if (!confirm(`「${displayName}」を${action}しますか？`)) {
      return;
    }

    setIsLoading(id);
    try {
      const token = await getAccessToken();
      const result = await togglePromptTemplateStatus(token, id);

      if (result.success) {
        onUpdate();
      } else {
        alert(`エラー: ${result.error}`);
      }
    } catch (error) {
      console.error('ステータス切り替えエラー:', error);
      alert('ステータス切り替えに失敗しました');
    } finally {
      setIsLoading(null);
    }
  };


  return (
    <div className="space-y-6">
      {/* フィルター */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">検索</label>
              <Input
                placeholder="プロンプト名や説明で検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ステータス</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">すべて</option>
                <option value="active">有効</option>
                <option value="inactive">無効</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
                className="w-full"
              >
                リセット
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* プロンプト一覧 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredTemplates.map(template => (
          <Card key={template.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2 mb-2">
                    <span>{template.display_name}</span>
                    <Badge variant="outline">v{template.version}</Badge>
                  </CardTitle>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>ID: <code className="text-xs bg-gray-100 px-1 rounded">{template.name}</code></div>
                    {(() => {
                      const promptDescription = getPromptDescription(template.name);
                      return promptDescription && (
                        <div>{promptDescription.description}</div>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={template.is_active ? 'default' : 'secondary'}>
                    {template.is_active ? '有効' : '無効'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* 変数一覧 */}
                {template.variables.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">変数:</div>
                    <div className="flex flex-wrap gap-1">
                      {template.variables.map(variable => (
                        <Badge key={variable.name} variant="outline" className="text-xs">
                          {variable.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* プレビュー */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">プレビュー:</div>
                  <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border max-h-20 overflow-hidden">
                    {template.content.substring(0, 150)}
                    {template.content.length > 150 && '...'}
                  </div>
                </div>

                {/* 更新情報 */}
                <div className="text-xs text-gray-500">
                  最終更新: {new Date(template.updated_at).toLocaleString('ja-JP')}
                </div>

                {/* アクション */}
                <div className="flex gap-2 pt-2">
                  <Link href={`/admin/prompts/${template.id}`} className="flex-1">
                    <Button variant="outline" className="w-full" size="sm">
                      編集
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleStatus(template.id, template.display_name, template.is_active)}
                    disabled={isLoading === template.id}
                  >
                    {isLoading === template.id ? '処理中...' : (template.is_active ? '無効化' : '有効化')}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(template.id, template.display_name)}
                    disabled={isLoading === template.id}
                  >
                    削除
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-gray-500">
              <div className="text-4xl mb-4">📝</div>
              <div className="text-lg mb-2">プロンプトが見つかりません</div>
              <div className="text-sm">
                {templates.length === 0 
                  ? 'まだプロンプトが作成されていません' 
                  : '検索条件に一致するプロンプトがありません'
                }
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}