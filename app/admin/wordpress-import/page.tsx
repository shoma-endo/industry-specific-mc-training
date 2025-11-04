'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useLiffContext } from '@/components/LiffProvider';

interface ImportResult {
  totalPosts: number;
  newPosts: number;
  skippedExistingPosts: number;
  skippedWithoutCanonical: number;
  insertedPosts: number;
  duplicatePosts: number;
  errorPosts: number;
  existingContentTotal: number;
  contentTypes: string[];
  statsByType: Record<
    string,
    {
      totalAvailable: number;
      retrieved: number;
      newCandidates: number;
      skippedExisting: number;
      skippedWithoutCanonical: number;
      inserted: number;
      duplicate: number;
      error: number;
    }
  >;
  maxLimitReached?: boolean;
  maxLimitValue?: number;
  backfilledTitles?: number;
}

export default function WordPressImportPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { getAccessToken } = useLiffContext();

  const formatTypeLabel = (type: string) => {
    const lowered = type.toLowerCase();
    if (lowered === 'posts') return '投稿';
    if (lowered === 'pages') return '固定ページ';
    return `カスタム投稿（${type}）`;
  };

  const handleImport = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const token = await getAccessToken();
      const response = await fetch('/api/admin/wordpress/bulk-import-posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'インポートに失敗しました');
      }

      if (data.success) {
        const normalized: ImportResult = {
          totalPosts: data.data?.totalPosts ?? 0,
          newPosts: data.data?.newPosts ?? 0,
          skippedExistingPosts: data.data?.skippedExistingPosts ?? 0,
          skippedWithoutCanonical: data.data?.skippedWithoutCanonical ?? 0,
          insertedPosts: data.data?.insertedPosts ?? 0,
          duplicatePosts: data.data?.duplicatePosts ?? 0,
          errorPosts: data.data?.errorPosts ?? 0,
          existingContentTotal: data.data?.existingContentTotal ?? 0,
          contentTypes: Array.isArray(data.data?.contentTypes)
            ? (data.data.contentTypes as string[])
            : [],
          statsByType:
            typeof data.data?.statsByType === 'object' && data.data?.statsByType !== null
              ? (data.data.statsByType as ImportResult['statsByType'])
              : {},
          maxLimitReached: Boolean(data.data?.maxLimitReached),
          maxLimitValue:
            typeof data.data?.maxLimitValue === 'number' && !Number.isNaN(data.data?.maxLimitValue)
              ? data.data.maxLimitValue
              : 1000,
          backfilledTitles:
            typeof data.data?.backfilledTitles === 'number' && !Number.isNaN(data.data?.backfilledTitles)
              ? data.data.backfilledTitles
              : 0,
        };
        setResult(normalized);
      } else {
        throw new Error(data.error || 'インポートに失敗しました');
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('LIFF') || err.message.includes('logged in')) {
          setError('LIFFアクセストークンを取得できません。LINEで再ログインしてください。');
        } else {
          setError(err.message);
        }
      } else {
        setError('不明なエラーが発生しました');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">WordPress記事一括インポート</h1>
        <p className="text-gray-600 mt-2">
          管理者自身のWordPressブログ記事URLをコンテンツとして一括登録します。
          既に登録されているURLはスキップされます。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>インポート実行</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              管理者権限でログインしているあなた自身のWordPressブログ記事URLを一括で取得し、
              コンテンツとして登録します。
            </p>
          </div>

          <Button
            onClick={handleImport}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                インポート実行中...
              </>
            ) : (
              '自分のWordPress記事を一括インポート'
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span>インポート完了</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.maxLimitReached && (
              <Alert variant="default" className="mb-4 border-yellow-300 bg-yellow-50 text-yellow-800">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  最大取得件数（{result.maxLimitValue ?? 1000}件）に達したため、これ以上のコンテンツは取得できませんでした。
                  投稿タイプや期間を絞り込んで再実行することをご検討ください。
                </AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{result.totalPosts}</div>
                <div className="text-sm text-gray-600">取得記事数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{result.newPosts}</div>
                <div className="text-sm text-gray-600">新規登録対象</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{result.insertedPosts}</div>
                <div className="text-sm text-gray-600">登録成功</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{result.skippedExistingPosts}</div>
                <div className="text-sm text-gray-600">既存でスキップ</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{result.duplicatePosts}</div>
                <div className="text-sm text-gray-600">重複スキップ</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{result.errorPosts}</div>
                <div className="text-sm text-gray-600">エラー</div>
              </div>
            </div>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">
                WordPressから{result.totalPosts}件の記事を取得しました。<br/>
                • 対象タイプ:{' '}
                {result.contentTypes.length > 0
                  ? result.contentTypes.map(formatTypeLabel).join(', ')
                  : '検出されませんでした'}<br/>
                • {result.newPosts}件を新規登録対象として処理<br/>
                • {result.insertedPosts}件を登録成功<br/>
                • {result.skippedExistingPosts}件を既存データとしてスキップ<br/>
                • {result.skippedWithoutCanonical}件をURL不足などでスキップ<br/>
                • {result.duplicatePosts}件がDB重複で失敗<br/>
                • {result.errorPosts}件でエラーが発生<br/>
                • 実行前の登録済みコンテンツ総数: {result.existingContentTotal}件
                {typeof result.backfilledTitles === 'number' && result.backfilledTitles > 0 && (
                  <>
                    <br />• タイトル補完 {result.backfilledTitles}件
                  </>
                )}
              </p>
            </div>

            {Object.keys(result.statsByType).length > 0 && (
              <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700">タイプ別内訳</h3>
                <div className="mt-3 space-y-3 text-xs text-gray-700">
                  {Object.entries(result.statsByType).map(([type, stats]) => (
                    <div key={type} className="border-b border-gray-100 pb-3 last:border-none last:pb-0">
                      <div className="text-sm font-medium text-gray-800">
                        {`${formatTypeLabel(type)}（取得 ${stats.retrieved}/${stats.totalAvailable}）`}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-gray-600">
                        <span>新規候補 {stats.newCandidates}</span>
                        <span>登録成功 {stats.inserted}</span>
                        <span>既存スキップ {stats.skippedExisting}</span>
                        <span>URL不足 {stats.skippedWithoutCanonical}</span>
                        <span>重複 {stats.duplicate}</span>
                        <span>エラー {stats.error}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
