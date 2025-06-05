'use client';

import React, { useState, useEffect } from 'react';

// API レスポンスの型定義 (変更の可能性あり)
interface TestConnectionResult {
  success: boolean;
  message?: string;
  error?: string;
  siteInfo?: {
    name: string;
    url: string;
  };
  needsWordPressAuth?: boolean; // 連携が必要かどうかのフラグ
}

interface ExportResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    postId: number;
    status: string;
    action: 'created' | 'updated';
    postUrl?: string;
    exportType?: 'post' | 'page';
  };
  needsWordPressAuth?: boolean;
}

export default function WordPressExportDebugPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticatedWithWordPress, setIsAuthenticatedWithWordPress] = useState(false);
  const [formData, setFormData] = useState({
    slug: '',
    userId: '',
    publishStatus: 'draft' as 'draft' | 'publish',
    updateExisting: false,
    exportType: 'post' as 'post' | 'page',
  });
  const [result, setResult] = useState<ExportResult | null>(null);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);

  // WordPress認証状態を確認する関数
  const checkWordPressAuth = async () => {
    setIsCheckingAuth(true);
    setTestResult(null); // 前回のテスト結果をクリア
    try {
      const response = await fetch('/api/wordpress/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      const data: TestConnectionResult = await response.json();
      if (data.success) {
        setIsAuthenticatedWithWordPress(true);
        setTestResult(data); // 接続成功情報も表示
      } else {
        setIsAuthenticatedWithWordPress(false);
        if (data.needsWordPressAuth) {
          // 連携が必要な旨をtestResultで表示しても良い
          setTestResult({
            success: false,
            error: 'WordPress.comとの連携が必要です。',
            needsWordPressAuth: true,
          });
        } else {
          setTestResult(data); // その他のエラー
        }
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
    checkWordPressAuth();
  }, []);

  const redirectToWordPressOAuth = () => {
    window.location.href = '/api/wordpress/oauth/start';
  };

  // フォームデータの更新
  const updateFormData = (key: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  // WordPress接続テスト (OAuth対応)
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

  // WordPressエクスポート実行 (OAuth対応)
  const exportToWordPress = async () => {
    if (!formData.slug || !formData.userId) {
      alert('スラッグとユーザーIDを入力してください');
      return;
    }
    setIsLoading(true);
    setResult(null);
    try {
      const response = await fetch('/api/wordpress/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          liffAccessToken: 'dummy-token',
          slug: formData.slug,
          userId: formData.userId,
          publishStatus: formData.publishStatus,
          updateExisting: formData.updateExisting,
          exportType: formData.exportType,
        }),
        credentials: 'include',
      });
      const data: ExportResult = await response.json();
      setResult(data);
      if (data.needsWordPressAuth) setIsAuthenticatedWithWordPress(false);
    } catch (error) {
      setResult({
        success: false,
        error: `エクスポートエラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl text-center">
        <p className="text-lg">WordPress.com 認証状態を確認中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">WordPress エクスポート デバッグ</h1>

      {!isAuthenticatedWithWordPress ? (
        <div className="space-y-6 p-6 border border-blue-200 bg-blue-50 rounded-lg">
          <h2 className="text-xl font-semibold text-blue-700">WordPress.com 未連携</h2>
          <p className="text-gray-600">
            コンテンツをエクスポートするには、まずWordPress.comアカウントとの連携が必要です。
          </p>
          <button
            onClick={redirectToWordPressOAuth}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            disabled={isLoading}
          >
            WordPress.comと連携する
          </button>
          {testResult && !testResult.success && (
            <div
              className={`mt-4 p-3 rounded-lg border ${testResult.needsWordPressAuth ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}
            >
              <p
                className={`${testResult.needsWordPressAuth ? 'text-yellow-700' : 'text-red-700'}`}
              >
                {testResult.error}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="p-4 rounded-lg border bg-green-50 border-green-200">
            <p className="text-green-700 font-semibold">WordPress.com と連携済みです。</p>
            {testResult && testResult.siteInfo && (
              <div className="mt-1 text-sm text-green-600">
                <p>サイト名: {testResult.siteInfo.name}</p>
                <p>URL: {testResult.siteInfo.url}</p>
              </div>
            )}
          </div>

          {/* ランディングページ選択 */}
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">ランディングページ</h2>
            <input
              type="text"
              placeholder="スラッグを入力 (例: my-landing-page)"
              value={formData.slug}
              onChange={e => updateFormData('slug', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="ユーザーIDを入力 (例: dev-dummy-app-user-id)"
              value={formData.userId}
              onChange={e => updateFormData('userId', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* WordPress設定 (publishStatus, updateExisting) */}
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">エクスポート設定</h2>
            <select
              value={formData.publishStatus}
              onChange={e => updateFormData('publishStatus', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="draft">下書き</option>
              <option value="publish">公開</option>
            </select>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="updateExisting"
                checked={formData.updateExisting}
                onChange={e => updateFormData('updateExisting', e.target.checked)}
                className="w-4 h-4 text-blue-600 border border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="updateExisting" className="text-sm text-gray-700">
                同じスラッグの既存投稿があれば更新する
              </label>
            </div>
            <select
              value={formData.exportType}
              onChange={e => updateFormData('exportType', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mt-2"
            >
              <option value="post">投稿としてエクスポート</option>
              <option value="page">固定ページとしてエクスポート</option>
            </select>
          </div>

          {/* アクション */}
          <div className="flex gap-4">
            <button
              onClick={testConnection}
              disabled={isLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '再接続テスト中...' : '接続再テスト'}
            </button>
            <button
              onClick={exportToWordPress}
              disabled={isLoading || !formData.slug || !formData.userId}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'エクスポート中...' : 'WordPressにエクスポート'}
            </button>
          </div>

          {/* 接続テスト結果表示 (連携済みの場合) */}
          {testResult && isAuthenticatedWithWordPress && (
            <div
              className={`p-4 rounded-lg border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
            >
              <h3 className="font-semibold mb-2">接続テスト結果</h3>
              <p className={testResult.success ? 'text-green-700' : 'text-red-700'}>
                {testResult.message || testResult.error}
              </p>
              {testResult.siteInfo && (
                <div className="mt-2 text-sm text-gray-600">
                  <p>サイト名: {testResult.siteInfo.name}</p>
                  <p>URL: {testResult.siteInfo.url}</p>
                </div>
              )}
            </div>
          )}

          {/* エクスポート結果 */}
          {result && (
            <div
              className={`p-4 rounded-lg border ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
            >
              <h3 className="font-semibold mb-2">エクスポート結果</h3>
              <p className={result.success ? 'text-green-700' : 'text-red-700'}>
                {result.message || result.error}
              </p>
              {result.data && (
                <div className="mt-2 text-sm text-gray-600">
                  <p>投稿ID: {result.data.postId}</p>
                  <p>ステータス: {result.data.status}</p>
                  <p>アクション: {result.data.action}</p>
                  {result.data.exportType && (
                    <p>タイプ: {result.data.exportType === 'page' ? '固定ページ' : '投稿'}</p>
                  )}
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
          )}
        </div>
      )}
    </div>
  );
}
