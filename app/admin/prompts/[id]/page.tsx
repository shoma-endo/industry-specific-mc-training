'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useParams, notFound } from 'next/navigation';
import { PromptEditor } from '../components/PromptEditor';
import { PromptTemplateWithVersions } from '@/types/prompt';
import { useLiffContext } from '@/components/ClientLiffProvider';
import { Card, CardContent } from '@/components/ui/card';

export default function PromptEditPage() {
  const params = useParams();
  const { getAccessToken } = useLiffContext();
  const [template, setTemplate] = useState<PromptTemplateWithVersions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const id = params?.id as string;

  useEffect(() => {
    const loadTemplate = async () => {
      if (!id) {
        setError('プロンプトIDが指定されていません');
        setIsLoading(false);
        return;
      }

      try {
        const token = await getAccessToken();
        const res = await fetch(`/api/admin/prompts/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const result = await res.json();

        if (result.success && result.data) {
          setTemplate(result.data);
          setError(null);
        } else {
          setError(result.error || 'プロンプトの取得に失敗しました');
        }
      } catch (error) {
        console.error('プロンプト取得エラー:', error);
        setError('プロンプトの取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplate();
  }, [id, getAccessToken]);

  if (isLoading) {
    return <PromptEditPageSkeleton />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">プロンプト編集</h1>
        </div>
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-red-500">
              <div className="text-4xl mb-4">⚠️</div>
              <div className="text-lg mb-2">エラーが発生しました</div>
              <div className="text-sm">{error}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!template) {
    notFound();
  }

  return <PromptEditor template={template} isEdit={true} />;
}

function PromptEditPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-20 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-16 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左側 */}
        <div className="space-y-6">
          <Card>
            <div className="p-6">
              <div className="h-6 w-24 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="space-y-4">
                <div>
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                </div>
                <div>
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                </div>
                <div>
                  <div className="h-4 w-16 bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-20 w-full bg-gray-200 rounded animate-pulse" />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="h-6 w-24 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="space-y-3">
                <div className="h-16 w-full bg-gray-200 rounded animate-pulse" />
                <div className="h-16 w-full bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          </Card>
        </div>

        {/* 右側 */}
        <div className="space-y-6">
          <Card>
            <div className="p-6">
              <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="h-96 w-full bg-gray-200 rounded animate-pulse" />
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="h-6 w-24 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="h-32 w-full bg-gray-200 rounded animate-pulse" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}