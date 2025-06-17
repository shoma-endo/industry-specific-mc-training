'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Database, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

// データベースから取得される型
interface DatabaseSanityProject {
  id: string;
  user_id: string;
  project_id: string;
  dataset: string;
  created_at: string;
}

interface Props {
  liffAccessToken: string;
  existingProject: DatabaseSanityProject | null;
}

export default function SanitySettingsForm({ liffAccessToken, existingProject }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  // フォームの状態
  const [sanityProjectId, setSanityProjectId] = useState(existingProject?.project_id || '');
  const [sanityDataset, setSanityDataset] = useState(existingProject?.dataset || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sanityProjectId || !sanityDataset) {
      setResult({ success: false, error: 'Project IDとDatasetは必須です' });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      // Sanity設定保存APIを呼び出し
      const response = await fetch('/api/sanity/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          liffAccessToken,
          projectId: sanityProjectId,
          dataset: sanityDataset,
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          message: existingProject ? 'Sanity設定を更新しました' : 'Sanity設定を保存しました',
        });

        // 少し遅延してからダッシュボードに戻る
        setTimeout(() => {
          router.push('/setup');
        }, 1500);
      } else {
        setResult({
          success: false,
          error: data.error || 'Sanity設定の保存に失敗しました',
        });
      }
    } catch (error) {
      setResult({
        success: false,
        error: `エラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* ヘッダー */}
      <div className="mb-8">
        <Link
          href="/setup"
          className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
        >
          <ArrowLeft size={20} className="mr-2" />
          設定ダッシュボードに戻る
        </Link>
        <div className="flex items-center gap-3 mb-4">
          <Database className="text-blue-500" size={32} />
          <h1 className="text-3xl font-bold">Sanity CMS 設定</h1>
        </div>
        <p className="text-gray-600">
          ランディングページのコンテンツ管理に使用するSanity CMSの設定を行います。
        </p>
      </div>

      {/* メインフォーム */}
      <Card>
        <CardHeader>
          <CardTitle>{existingProject ? 'Sanity設定を編集' : 'Sanity設定を追加'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Sanity Project ID */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Sanity Project ID <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="例: abc123def"
                value={sanityProjectId}
                onChange={e => setSanityProjectId(e.target.value)}
                className="w-full"
                required
              />
              <p className="text-xs text-gray-500">
                Sanity管理画面で確認できるProject IDを入力してください
              </p>
            </div>

            {/* Dataset */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Dataset <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="例: development, production"
                value={sanityDataset}
                onChange={e => setSanityDataset(e.target.value)}
                className="w-full"
                required
              />
              <p className="text-xs text-gray-500">使用するデータセット名を入力してください</p>
            </div>

            {/* 結果表示 */}
            {result && (
              <div
                className={`p-4 rounded-lg ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
              >
                <div className="flex items-center gap-2">
                  {result.success ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                  <p>{result.success ? result.message : result.error}</p>
                </div>
              </div>
            )}

            {/* アクションボタン */}
            <div className="flex gap-4">
              <Link href="/setup" className="flex-1">
                <Button type="button" variant="outline" className="w-full">
                  キャンセル
                </Button>
              </Link>
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? '保存中...' : existingProject ? '設定を更新' : '設定を保存'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 設定ガイド */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Sanity設定ガイド</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm text-gray-700">
            <div>
              <h4 className="font-medium mb-2">1. Project IDの取得方法</h4>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Sanity管理画面にログイン</li>
                <li>プロジェクトを選択</li>
                <li>設定画面でProject IDを確認</li>
              </ol>
            </div>
            <div>
              <h4 className="font-medium mb-2">2. 注意事項</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Project IDの確認は必ずSanity管理画面で行ってください</li>
                <li>設定後はSanity Studioでコンテンツ管理が可能になります</li>
                <li>ランディングページの作成機能を使用できるようになります</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
