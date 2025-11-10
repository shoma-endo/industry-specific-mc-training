'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorAlert } from '@/components/ErrorAlert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PromptTemplate } from '@/types/prompt';
import { useLiffContext } from '@/components/LiffProvider';
import { getPromptDescription, getVariableDescription } from '@/lib/prompt-descriptions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFeedbackDialog } from '@/hooks/useFeedbackDialog';

export default function PromptsPage() {
  const { getAccessToken } = useLiffContext();
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { feedback, showFeedback, closeFeedback } = useFeedbackDialog();

  const loadTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = await getAccessToken();
      const res = await fetch('/api/admin/prompts', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const result = await res.json();
      if (result?.success && result?.data) {
        setTemplates(result.data as PromptTemplate[]);
        setError(null);
      } else {
        setError(result?.error || 'プロンプトの取得に失敗しました');
      }
    } catch (error) {
      console.error('プロンプト取得エラー:', error);
      setError('プロンプトの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      setEditedContent(template.content);
    }
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;

    try {
      setIsSaving(true);
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/prompts/${selectedTemplate.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: selectedTemplate.name,
          display_name: selectedTemplate.display_name,
          content: editedContent,
          variables: selectedTemplate.variables,
        }),
      });
      const result = await res.json();

      if (result?.success) {
        // テンプレート一覧を更新
        await loadTemplates();
        // 選択中のテンプレートも更新
        const updatedTemplate = { ...selectedTemplate, content: editedContent };
        setSelectedTemplate(updatedTemplate);
        setError(null);
        showFeedback({
          variant: 'success',
          title: 'プロンプトを保存しました',
          message: '内容が更新されました。',
        });
      } else {
        const message = result?.error || '保存に失敗しました';
        setError(message);
        showFeedback({
          variant: 'error',
          title: '保存に失敗しました',
          message,
        });
      }
    } catch (error) {
      console.error('保存エラー:', error);
      const message = '保存中にエラーが発生しました';
      setError(message);
      showFeedback({
        variant: 'error',
        title: '保存に失敗しました',
        message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (selectedTemplate) {
      setEditedContent(selectedTemplate.content);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Early return pattern
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">プロンプト管理</h1>
        <Card>
          <CardContent className="py-12">
            <div className="mx-auto max-w-md space-y-4">
              <div className="text-center">
                <h2 className="text-lg font-semibold mb-2">エラーが発生しました</h2>
              </div>
              <ErrorAlert error={error} />
              <div className="text-center">
                <Button
                  onClick={loadTemplates}
                  size="sm"
                  variant="outline"
                  aria-label="再試行"
                >
                  再試行
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const promptDescription = selectedTemplate ? getPromptDescription(selectedTemplate.name) : null;
  const variablesInfoText = (() => {
    const sanitizedVariables = (selectedTemplate?.variables || []).filter(
      v => v.name !== 'canonicalUrls' && v.name !== 'wpPostTitle'
    );
    const names = new Set(sanitizedVariables.map(v => v.name));
    const extra: string[] = [];
    if (names.has('canonicalLinkPairs')) {
      extra.push(getVariableDescription('canonicalLinkPairs'));
    }
    // ブログ作成ステップ用の content_annotations 由来の暗黙変数（テンプレ内に現れなくても説明に提示）
    const contentVars = [
      'contentNeeds',
      'contentPersona',
      'contentGoal',
      'contentPrep',
      'contentBasicStructure',
      'contentOpeningProposal',
    ];
    contentVars.forEach(v => {
      // 既にDB側variablesに定義されていない場合でも使用可能なので表示
      extra.push(getVariableDescription(v));
    });
    return extra.length > 0 ? extra.join(' ／ ') : null;
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">プロンプト管理</h1>
        <p className="mt-2 text-gray-600">プロンプトテンプレートを選択して内容を編集します</p>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="mb-6">
          <ErrorAlert error={error} />
        </div>
      )}

      {/* プロンプトテンプレート選択 */}
      <Card>
        <CardHeader>
          <CardTitle>プロンプトテンプレート選択</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedTemplate?.id || ''} onValueChange={handleTemplateSelect}>
            <SelectTrigger className="w-full" aria-label="プロンプトテンプレート選択" tabIndex={0}>
              <SelectValue placeholder="編集するプロンプトテンプレートを選択してください" />
            </SelectTrigger>
            <SelectContent>
              {templates.map(template => (
                <SelectItem key={template.id} value={template.id}>
                  {template.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* プロンプト詳細・編集 */}
      {selectedTemplate && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedTemplate.display_name}</CardTitle>
            <div className="text-xs text-gray-500 mt-1">
              最終更新: {new Date(selectedTemplate.updated_at).toLocaleString('ja-JP')}
            </div>
            {(promptDescription || variablesInfoText) && (
              <div className="text-sm text-gray-600 space-y-2">
                {promptDescription?.description && (
                  <p>
                    <strong>説明:</strong> {promptDescription.description}
                  </p>
                )}
                {variablesInfoText && (
                  <p>
                    <strong>使用可能な変数:</strong> {variablesInfoText}
                  </p>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label
                htmlFor="prompt-content"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                プロンプト内容
              </label>
              <Textarea
                id="prompt-content"
                value={editedContent}
                onChange={e => setEditedContent(e.target.value)}
                rows={15}
                className="w-full"
                placeholder="プロンプト内容を入力してください"
                aria-label="プロンプト内容編集"
                tabIndex={0}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={isSaving || editedContent === selectedTemplate.content}
                aria-label="保存"
                tabIndex={0}
              >
                {isSaving ? '保存中...' : '保存'}
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={editedContent === selectedTemplate.content}
                aria-label="リセット"
                tabIndex={0}
              >
                リセット
              </Button>
            </div>

            {/* 変数一覧 */}
            {(() => {
              const displayedVariables = (selectedTemplate.variables || []).filter(
                v => v.name !== 'canonicalUrls' && v.name !== 'wpPostTitle'
              );
              const implicitContentVars = [
                { name: 'contentNeeds', description: getVariableDescription('contentNeeds') },
                { name: 'contentPersona', description: getVariableDescription('contentPersona') },
                { name: 'contentGoal', description: getVariableDescription('contentGoal') },
                { name: 'contentPrep', description: getVariableDescription('contentPrep') },
                {
                  name: 'contentBasicStructure',
                  description: getVariableDescription('contentBasicStructure'),
                },
                {
                  name: 'contentOpeningProposal',
                  description: getVariableDescription('contentOpeningProposal'),
                },
              ];
              const implicitCanonical = [
                {
                  name: 'canonicalLinkPairs',
                  description: getVariableDescription('canonicalLinkPairs'),
                },
              ];
              const showImplicit = selectedTemplate.name.startsWith('blog_creation_');
              const combinedVars = showImplicit
                ? [...displayedVariables, ...implicitContentVars, ...implicitCanonical]
                : displayedVariables;
              const seen = new Set<string>();
              const allVars = combinedVars.filter(variable => {
                if (seen.has(variable.name)) {
                  return false;
                }
                seen.add(variable.name);
                return true;
              });

              return allVars.length > 0 ? (
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">使用可能な変数</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {allVars.map((variable, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-md">
                        <div className="font-mono text-sm text-blue-600">
                          {`{{${variable.name}}}`}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">{variable.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}
          </CardContent>
        </Card>
      )}
      <Dialog
        open={feedback.open}
        onOpenChange={open => {
          if (!open) {
            closeFeedback();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={feedback.variant === 'success' ? 'text-green-600' : 'text-red-600'}>
              {feedback.title}
            </DialogTitle>
            {feedback.message && <DialogDescription>{feedback.message}</DialogDescription>}
          </DialogHeader>
          <DialogFooter>
            <Button
              variant={feedback.variant === 'success' ? 'default' : 'destructive'}
              onClick={closeFeedback}
            >
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
