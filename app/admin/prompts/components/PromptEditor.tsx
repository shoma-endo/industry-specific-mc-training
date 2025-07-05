'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { updatePromptTemplate, createPromptTemplate } from '@/server/handler/actions/prompt.actions';
import { useLiffContext } from '@/components/ClientLiffProvider';
import { PromptTemplateWithVersions, PromptVariable } from '@/types/prompt';
import { getPromptDescription } from '@/lib/prompt-descriptions';

interface Props {
  template?: PromptTemplateWithVersions;
  isEdit?: boolean;
}

export function PromptEditor({ template, isEdit = false }: Props) {
  const router = useRouter();
  const { getAccessToken } = useLiffContext();
  
  // フォームの状態
  const [formData, setFormData] = useState({
    name: template?.name || '',
    display_name: template?.display_name || '',
    content: template?.content || '',
    variables: template?.variables || [] as PromptVariable[],
    is_active: template?.is_active ?? true
  });
  
  const [changeSummary, setChangeSummary] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showVariableForm, setShowVariableForm] = useState(false);
  const [newVariable, setNewVariable] = useState({ name: '', description: '' });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // バリデーション
  const validateForm = useCallback(() => {
    const errors: string[] = [];
    
    if (!formData.name.trim()) errors.push('プロンプト名は必須です');
    if (!formData.display_name.trim()) errors.push('表示名は必須です');
    if (!formData.content.trim()) errors.push('プロンプト内容は必須です');
    
    // 変数の整合性チェック
    const contentVariables = formData.content.match(/{{(\w+)}}/g) || [];
    const definedVariables = formData.variables.map(v => `{{${v.name}}}`);
    const undefinedVariables = contentVariables.filter(v => !definedVariables.includes(v));
    
    if (undefinedVariables.length > 0) {
      errors.push(`未定義の変数があります: ${undefinedVariables.join(', ')}`);
    }
    
    setValidationErrors(errors);
    return errors.length === 0;
  }, [formData]);

  // 保存処理
  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    if (isEdit && !changeSummary.trim()) {
      alert('変更内容の要約を入力してください');
      return;
    }

    setIsSaving(true);
    try {
      const token = await getAccessToken();
      let result;

      if (isEdit && template) {
        result = await updatePromptTemplate(
          token,
          template.id,
          formData,
          changeSummary
        );
      } else {
        result = await createPromptTemplate(token, formData);
      }

      if (result.success) {
        alert(isEdit ? 'プロンプトを更新しました' : 'プロンプトを作成しました');
        if (!isEdit) {
          router.push('/admin/prompts');
        } else {
          setChangeSummary('');
        }
      } else {
        alert(`エラー: ${result.error}`);
      }
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  }, [formData, changeSummary, isEdit, template, getAccessToken, router, validateForm]);

  // 変数追加
  const handleAddVariable = () => {
    if (!newVariable.name.trim() || !newVariable.description.trim()) {
      alert('変数名と説明を入力してください');
      return;
    }

    if (formData.variables.some(v => v.name === newVariable.name)) {
      alert('同じ名前の変数が既に存在します');
      return;
    }

    setFormData(prev => ({
      ...prev,
      variables: [...prev.variables, newVariable]
    }));
    
    setNewVariable({ name: '', description: '' });
    setShowVariableForm(false);
  };

  // 変数削除
  const handleRemoveVariable = (name: string) => {
    setFormData(prev => ({
      ...prev,
      variables: prev.variables.filter(v => v.name !== name)
    }));
  };

  // プレビュー機能
  const generatePreview = () => {
    let preview = formData.content;
    formData.variables.forEach(variable => {
      const regex = new RegExp(`{{${variable.name}}}`, 'g');
      preview = preview.replace(regex, `[${variable.description}]`);
    });
    return preview;
  };

  // リアルタイムバリデーション
  useEffect(() => {
    validateForm();
  }, [validateForm]);

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isEdit ? 'プロンプト編集' : 'プロンプト作成'}
          </h1>
          {template && (
            <div className="mt-1">
              <p className="text-gray-600">
                {template.display_name} (v{template.version})
              </p>
              {(() => {
                const promptDescription = getPromptDescription(template.name);
                return promptDescription && (
                  <p className="text-sm text-blue-600 mt-1">
                    {promptDescription.description}
                  </p>
                );
              })()}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            キャンセル
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isSaving || validationErrors.length > 0}
          >
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>

      {/* バリデーションエラー */}
      {validationErrors.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="text-red-800">
              <div className="font-medium mb-2">入力エラー:</div>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左側: フォーム */}
        <div className="space-y-6">
          {/* 基本情報 */}
          <Card>
            <CardHeader>
              <CardTitle>基本情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  プロンプト名 (ID) *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="ad_copy_creation"
                  className="font-mono"
                />
                <div className="text-xs text-gray-500 mt-1">
                  英数字とアンダースコアのみ使用可能
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  表示名 *
                </label>
                <Input
                  value={formData.display_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                  placeholder="広告コピー作成プロンプト"
                />
              </div>



              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, is_active: !!checked }))
                  }
                />
                <label htmlFor="is_active" className="text-sm font-medium">
                  有効にする
                </label>
              </div>
            </CardContent>
          </Card>

          {/* 変数管理 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                変数設定
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVariableForm(!showVariableForm)}
                >
                  変数追加
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 変数追加フォーム */}
              {showVariableForm && (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">変数名</label>
                      <Input
                        value={newVariable.name}
                        onChange={(e) => setNewVariable(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="service_name"
                        className="font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">説明</label>
                      <Input
                        value={newVariable.description}
                        onChange={(e) => setNewVariable(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="提供サービス名"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddVariable}>
                        追加
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowVariableForm(false)}
                      >
                        キャンセル
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* 変数一覧 */}
              <div className="space-y-2">
                {formData.variables.map(variable => (
                  <div key={variable.name} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <div className="font-mono text-sm text-blue-600">
                        {`{{${variable.name}}}`}
                      </div>
                      <div className="text-sm text-gray-600">
                        {variable.description}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveVariable(variable.name)}
                    >
                      削除
                    </Button>
                  </div>
                ))}
                
                {formData.variables.length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    変数が設定されていません
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右側: プロンプト編集とプレビュー */}
        <div className="space-y-6">
          {/* プロンプト編集 */}
          <Card>
            <CardHeader>
              <CardTitle>プロンプト内容</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                className="min-h-[400px] font-mono text-sm"
                placeholder="プロンプト内容を入力してください..."
              />
              <div className="mt-2 text-xs text-gray-500">
                変数は {`{{variable_name}}`} の形式で記述してください
              </div>
            </CardContent>
          </Card>

          {/* プレビュー */}
          <Card>
            <CardHeader>
              <CardTitle>プレビュー</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-4 rounded-lg border">
                <pre className="text-sm whitespace-pre-wrap">
                  {generatePreview()}
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* 変更要約（編集時のみ） */}
          {isEdit && (
            <Card>
              <CardHeader>
                <CardTitle>変更内容の要約 *</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  placeholder="何を変更したかを簡潔に説明してください"
                  rows={3}
                />
              </CardContent>
            </Card>
          )}

          {/* バージョン履歴（編集時のみ） */}
          {isEdit && template && template.versions && template.versions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>バージョン履歴</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {template.versions.map(version => (
                    <div key={version.id} className="border-l-4 border-blue-200 pl-4">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">v{version.version}</Badge>
                        <div className="text-xs text-gray-500">
                          {new Date(version.created_at).toLocaleString('ja-JP')}
                        </div>
                      </div>
                      {version.change_summary && (
                        <div className="text-sm text-gray-600 mt-1">
                          {version.change_summary}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}