'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plug, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { WordPressType } from '@/types/wordpress';

interface ExistingWordPressSettings {
  id?: string;
  wpType: WordPressType;
  wpSiteId?: string;
  wpSiteUrl?: string;
  wpUsername?: string;
  wpApplicationPassword?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Props {
  liffAccessToken: string;
  existingSettings: ExistingWordPressSettings | null;
}

export default function WordPressSettingsForm({ liffAccessToken, existingSettings }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  // フォームの状態
  const [wpType, setWpType] = useState<WordPressType>(existingSettings?.wpType || 'wordpress_com');
  
  // WordPress.com用
  const [wpSiteId, setWpSiteId] = useState(existingSettings?.wpSiteId || '');
  
  // セルフホスト用
  const [wpSiteUrl, setWpSiteUrl] = useState(existingSettings?.wpSiteUrl || '');
  const [wpUsername, setWpUsername] = useState(existingSettings?.wpUsername || '');
  const [wpApplicationPassword, setWpApplicationPassword] = useState(existingSettings?.wpApplicationPassword || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // バリデーション
    if (wpType === 'wordpress_com' && !wpSiteId) {
      setResult({ success: false, error: 'WordPress.comのサイトIDが必要です' });
      return;
    }
    
    if (wpType === 'self_hosted' && (!wpSiteUrl || !wpUsername || !wpApplicationPassword)) {
      setResult({ success: false, error: 'セルフホスト版では、サイトURL、ユーザー名、アプリケーションパスワードがすべて必要です' });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      // WordPress設定保存APIを呼び出し
      const response = await fetch('/api/wordpress/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          liffAccessToken,
          wpType,
          ...(wpType === 'wordpress_com' ? { wpSiteId } : {
            wpSiteUrl,
            wpUsername,
            wpApplicationPassword,
          }),
        }),
        credentials: 'include',
      });
      
      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          message: existingSettings ? 'WordPress設定を更新しました' : 'WordPress設定を保存しました',
        });
        
        // 少し遅延してからダッシュボードに戻る
        setTimeout(() => {
          router.push('/setup');
        }, 1500);
      } else {
        setResult({
          success: false,
          error: data.error || 'WordPress設定の保存に失敗しました',
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

  const redirectToWordPressOAuth = () => {
    window.location.href = '/api/wordpress/oauth/start';
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* ヘッダー */}
      <div className="mb-8">
        <Link href="/setup" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4">
          <ArrowLeft size={20} className="mr-2" />
          設定ダッシュボードに戻る
        </Link>
        <div className="flex items-center gap-3 mb-4">
          <Plug className="text-purple-500" size={32} />
          <h1 className="text-3xl font-bold">WordPress 設定</h1>
        </div>
        <p className="text-gray-600">
          ランディングページの公開先となるWordPressサイトの設定を行います。
        </p>
      </div>

      {/* メインフォーム */}
      <Card>
        <CardHeader>
          <CardTitle>
            {existingSettings ? 'WordPress設定を編集' : 'WordPress設定を追加'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* WordPress種別選択 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                WordPress種別 <span className="text-red-500">*</span>
              </label>
              <Select value={wpType} onValueChange={(value: WordPressType) => setWpType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="WordPress種別を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wordpress_com">WordPress.com</SelectItem>
                  <SelectItem value="self_hosted">セルフホスト版WordPress</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* WordPress.com用設定 */}
            {wpType === 'wordpress_com' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    WordPress.com サイトID <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="例: 123456789"
                    value={wpSiteId}
                    onChange={(e) => setWpSiteId(e.target.value)}
                    className="w-full"
                    required
                  />
                  <p className="text-xs text-gray-500">
                    WordPress.com管理画面で確認できるサイトIDを入力してください
                  </p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">OAuth認証について</h4>
                  <p className="text-sm text-blue-700 mb-3">
                    WordPress.comとの連携には、OAuth認証が必要です。
                    サイトIDを設定後、OAuth認証を行ってください。
                  </p>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={redirectToWordPressOAuth}
                    className="border-blue-300 text-blue-700 hover:bg-blue-100"
                  >
                    WordPress.com OAuth認証を開始
                  </Button>
                </div>
              </div>
            )}

            {/* セルフホスト版設定 */}
            {wpType === 'self_hosted' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    サイトURL <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="https://example.com"
                    value={wpSiteUrl}
                    onChange={(e) => setWpSiteUrl(e.target.value)}
                    className="w-full"
                    required
                  />
                  <p className="text-xs text-gray-500">
                    WordPressサイトのURLを入力してください（例: https://example.com）
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    ユーザー名 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="admin"
                    value={wpUsername}
                    onChange={(e) => setWpUsername(e.target.value)}
                    className="w-full"
                    required
                  />
                  <p className="text-xs text-gray-500">
                    WordPressの管理者ユーザー名を入力してください
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    アプリケーションパスワード <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="password"
                    placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                    value={wpApplicationPassword}
                    onChange={(e) => setWpApplicationPassword(e.target.value)}
                    className="w-full"
                    required
                  />
                  <p className="text-xs text-gray-500">
                    WordPress管理画面で生成したアプリケーションパスワードを入力してください
                  </p>
                </div>
              </div>
            )}

            {/* 結果表示 */}
            {result && (
              <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
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
                {isLoading
                  ? '保存中...'
                  : existingSettings
                  ? '設定を更新'
                  : '設定を保存'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 設定ガイド */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>WordPress設定ガイド</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6 text-sm text-gray-700">
            {/* WordPress.com設定ガイド */}
            <div>
              <h4 className="font-medium mb-2 text-blue-700">WordPress.com の場合</h4>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>WordPress.com にログイン</li>
                <li>「サイト管理」→「設定」→「一般」でサイトIDを確認</li>
                <li>上記フォームにサイトIDを入力</li>
                <li>OAuth認証ボタンをクリックして認証完了</li>
              </ol>
            </div>

            {/* セルフホスト設定ガイド */}
            <div>
              <h4 className="font-medium mb-2 text-purple-700">セルフホスト版 の場合</h4>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>WordPress管理画面にログイン</li>
                <li>「ユーザー」→「プロフィール」→「アプリケーションパスワード」</li>
                <li>新しいアプリケーションパスワードを生成</li>
                <li>生成されたパスワード（xxxx xxxx 形式）をコピー</li>
                <li>上記フォームに必要情報を入力</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium mb-2">注意事項</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>アプリケーションパスワードは通常のログインパスワードとは異なります</li>
                <li>セルフホスト版では、サイトでREST APIが有効になっている必要があります</li>
                <li>管理者権限のユーザーアカウントを使用してください</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}