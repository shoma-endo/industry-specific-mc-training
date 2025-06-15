'use client';

import React, { useState, useEffect } from 'react';
import { useLiffContext } from '@/components/LiffProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Bot, AlertCircle, CheckCircle, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';

// API レスポンスの型定義
interface TestConnectionResult {
  success: boolean;
  connected?: boolean;
  message?: string | undefined;
  error?: string | undefined;
  siteInfo?:
    | {
        name: string;
        url: string;
      }
    | undefined;
  needsWordPressAuth?: boolean;
}

interface LandingPageCreateResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    postId: number;
    status: string;
    action: 'created' | 'updated';
    postUrl?: string;
    exportType?: 'post' | 'page';
    title?: string;
    slug?: string;
  };
  needsWordPressAuth?: boolean;
}

export default function AdFormPage() {
  const { isLoggedIn, login, getAccessToken } = useLiffContext();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticatedWithWordPress, setIsAuthenticatedWithWordPress] = useState(false);

  const [formData, setFormData] = useState({
    headline: '',
    description: '',
    updateExisting: false,
  });

  const [result, setResult] = useState<LandingPageCreateResult | null>(null);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);

  // WordPress認証状態を確認する関数
  const checkWordPressAuth = async () => {
    if (!isLoggedIn) {
      setIsCheckingAuth(false);
      return;
    }

    setIsCheckingAuth(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/wordpress/test-connection', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      if (!text) {
        throw new Error('Empty response from server');
      }

      let data: TestConnectionResult;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
      }

      if (data.success && data.connected) {
        setIsAuthenticatedWithWordPress(true);
        setTestResult({
          success: true,
          message: data.message,
          siteInfo: data.siteInfo,
        });
      } else {
        setIsAuthenticatedWithWordPress(false);
        setTestResult({
          success: false,
          error: data.message || data.error || 'WordPress.comとの連携が必要です。',
          needsWordPressAuth: true,
        });
      }
    } catch (error) {
      setIsAuthenticatedWithWordPress(false);
      setTestResult({
        success: false,
        error: `認証状態確認エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsCheckingAuth(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      checkWordPressAuth();
    } else {
      setIsCheckingAuth(false);
    }
  }, [isLoggedIn]);

  const redirectToWordPressOAuth = () => {
    window.location.href = '/api/wordpress/oauth/start';
  };

  // フォームデータの更新
  const updateFormData = (key: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  // WordPress接続テスト
  const testConnection = async () => {
    setIsLoading(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/wordpress/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      const data: TestConnectionResult = await response.json();
      setTestResult(data);
      if (data.success) {
        setIsAuthenticatedWithWordPress(true);
      }
      if (data.needsWordPressAuth) setIsAuthenticatedWithWordPress(false);
    } catch (error) {
      setTestResult({
        success: false,
        error: `接続テストエラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ランディングページ作成・WordPressエクスポート実行
  const createLandingPage = async () => {
    if (!formData.headline || !formData.description) {
      alert('見出しと説明文を入力してください');
      return;
    }
    setIsLoading(true);
    setResult(null);

    try {
      const liffAccessToken = await getAccessToken();
      if (!liffAccessToken) {
        throw new Error('LINE認証情報の取得に失敗しました');
      }

      const response = await fetch('/api/ad-form/create-landing-page', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          liffAccessToken: liffAccessToken,
          headline: formData.headline,
          description: formData.description,
          updateExisting: formData.updateExisting,
        }),
        credentials: 'include',
      });

      const data: LandingPageCreateResult = await response.json();
      setResult(data);
      if (data.needsWordPressAuth) setIsAuthenticatedWithWordPress(false);
    } catch (error) {
      setResult({
        success: false,
        error: `ランディングページ作成エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3rem)]">
        <Card className="p-6 text-center max-w-xs w-full shadow-lg rounded-xl">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bot size={32} className="text-primary" />
          </div>
          <h2 className="text-lg font-semibold mb-3">ランディングページ作成</h2>
          <p className="text-sm text-muted-foreground mb-4">
            ランディングページ作成機能を利用するにはLINEでログインしてください。
          </p>
          <Button onClick={login} className="w-full">
            LINEでログイン
          </Button>
        </Card>
      </div>
    );
  }

  if (isCheckingAuth) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl text-center">
        <p className="text-lg">WordPress.com 認証状態を確認中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-center">ランディングページ作成</h1>
      <p className="text-center text-gray-600 mb-8">
        広告の見出しと説明文からランディングページを自動生成し、WordPressに保存します
      </p>

      {!isAuthenticatedWithWordPress ? (
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-yellow-600">
                <AlertCircle size={24} />
                <h2 className="text-xl font-semibold">WordPress.com 未連携</h2>
              </div>
              <p className="text-gray-600">
                ランディングページをWordPressに保存するには、まずWordPress.comアカウントとの連携が必要です。
              </p>
              <Button onClick={redirectToWordPressOAuth} className="w-full" disabled={isLoading}>
                WordPress.comと連携する
              </Button>
              {testResult && !testResult.success && (
                <div className="p-3 rounded-lg border bg-yellow-50 border-yellow-200">
                  <p className="text-yellow-700">{testResult.error}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 text-green-600">
                  <CheckCircle size={24} />
                  <p className="font-semibold">WordPressと連携済みです</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/setup?edit=true')}
                  className="flex items-center gap-2"
                >
                  <Settings size={16} />
                  設定を編集
                </Button>
              </div>
              {testResult && testResult.siteInfo && (
                <div className="text-sm text-gray-600">
                  <p>サイト名: {testResult.siteInfo.name}</p>
                  <p>URL: {testResult.siteInfo.url}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>広告文情報入力</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  見出し <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="広告の見出しを入力してください"
                  value={formData.headline}
                  onChange={e => updateFormData('headline', e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  説明文 <span className="text-red-500">*</span>
                </label>
                <Textarea
                  placeholder="広告の説明文を入力してください"
                  value={formData.description}
                  onChange={e => updateFormData('description', e.target.value)}
                  className="w-full min-h-24"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="updateExisting"
                  checked={formData.updateExisting}
                  onCheckedChange={checked => updateFormData('updateExisting', checked)}
                />
                <label htmlFor="updateExisting" className="text-sm text-gray-700">
                  同じタイトルの既存ページがあれば更新する
                </label>
              </div>
            </CardContent>
          </Card>

          {/* アクション */}
          <div className="flex gap-4">
            <Button
              onClick={testConnection}
              disabled={isLoading}
              variant="outline"
              className="flex-1"
            >
              {isLoading ? '接続テスト中...' : '接続再テスト'}
            </Button>
            <Button
              onClick={createLandingPage}
              disabled={isLoading || !formData.headline || !formData.description}
              className="flex-2"
            >
              {isLoading
                ? 'ランディングページ作成中...'
                : 'ランディングページを作成してWordPressに保存'}
            </Button>
          </div>

          {/* 接続テスト結果表示 */}
          {testResult && isAuthenticatedWithWordPress && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">接続テスト結果</h3>
                <div
                  className={`p-3 rounded-lg ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
                >
                  <p>{testResult.message || testResult.error}</p>
                  {testResult.siteInfo && (
                    <div className="mt-2 text-sm">
                      <p>サイト名: {testResult.siteInfo.name}</p>
                      <p>URL: {testResult.siteInfo.url}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 作成結果 */}
          {result && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">ランディングページ作成結果</h3>
                <div
                  className={`p-3 rounded-lg ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
                >
                  <p>{result.message || result.error}</p>
                  {result.data && (
                    <div className="mt-2 text-sm">
                      <p>タイトル: {result.data.title}</p>
                      <p>スラッグ: {result.data.slug}</p>
                      <p>投稿ID: {result.data.postId}</p>
                      <p>ステータス: {result.data.status}</p>
                      <p>アクション: {result.data.action === 'created' ? '新規作成' : '更新'}</p>
                      {result.data.postUrl && (
                        <p>
                          投稿URL:{' '}
                          <a
                            href={result.data.postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline"
                          >
                            {result.data.postUrl}
                          </a>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 使用方法 */}
          <Card>
            <CardHeader>
              <CardTitle>使用方法</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                <li>広告の見出しと説明文を入力してください（必須）</li>
                <li>既存ページの更新が必要な場合はチェックボックスを有効にしてください</li>
                <li>「ランディングページを作成してWordPressに保存」ボタンをクリックしてください</li>
                <li>AIが自動でランディングページを生成し、WordPressに下書きとして保存します</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
