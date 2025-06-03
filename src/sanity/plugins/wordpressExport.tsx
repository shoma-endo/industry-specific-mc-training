/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { definePlugin, Tool } from 'sanity';
import { Card, Stack, Text, TextInput, Button, Select, Flex, Checkbox } from '@sanity/ui';

// WordPressエクスポートツールコンポーネント
function WordPressExportTool() {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    slug: '',
    wordpressSiteUrl: '',
    wordpressUsername: '',
    wordpressAppPassword: '',
    publishStatus: 'draft' as 'draft' | 'publish',
    updateExisting: false,
  });
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    data?: any;
    error?: string;
  } | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    siteInfo?: any;
    error?: string;
  } | null>(null);

  // フォームデータの更新
  const updateFormData = (key: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  // WordPress接続テスト
  const testConnection = async () => {
    if (
      !formData.wordpressSiteUrl ||
      !formData.wordpressUsername ||
      !formData.wordpressAppPassword
    ) {
      setTestResult({
        success: false,
        message: 'すべてのWordPress認証情報を入力してください',
      });
      return;
    }

    setIsLoading(true);
    setTestResult(null);

    try {
      // LIFFアクセストークンを取得（クッキーから）
      const response = await fetch('/api/user/current', {
        credentials: 'include',
      });
      const { userId } = await response.json();

      if (!userId) {
        throw new Error('ユーザー認証が必要です');
      }

      const testResponse = await fetch('/api/wordpress/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          liffAccessToken: 'dummy-token', // 実際の実装では適切なトークンを取得
          wordpressSiteUrl: formData.wordpressSiteUrl,
          wordpressUsername: formData.wordpressUsername,
          wordpressAppPassword: formData.wordpressAppPassword,
        }),
        credentials: 'include',
      });

      const testData = await testResponse.json();

      setTestResult({
        success: testData.success,
        message: testData.success ? '接続成功' : testData.error,
        siteInfo: testData.siteInfo,
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: `接続テストエラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // WordPressエクスポート実行
  const exportToWordPress = async () => {
    if (!formData.slug) {
      setResult({
        success: false,
        message: 'スラッグを入力してください',
      });
      return;
    }

    if (
      !formData.wordpressSiteUrl ||
      !formData.wordpressUsername ||
      !formData.wordpressAppPassword
    ) {
      setResult({
        success: false,
        message: 'すべてのWordPress認証情報を入力してください',
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      // LIFFアクセストークンを取得（クッキーから）
      const response = await fetch('/api/user/current', {
        credentials: 'include',
      });
      const { userId } = await response.json();

      if (!userId) {
        throw new Error('ユーザー認証が必要です');
      }

      const exportResponse = await fetch('/api/wordpress/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          liffAccessToken: 'dummy-token', // 実際の実装では適切なトークンを取得
          slug: formData.slug,
          wordpressSiteUrl: formData.wordpressSiteUrl,
          wordpressUsername: formData.wordpressUsername,
          wordpressAppPassword: formData.wordpressAppPassword,
          publishStatus: formData.publishStatus,
          updateExisting: formData.updateExisting,
        }),
        credentials: 'include',
      });

      const exportData = await exportResponse.json();

      setResult({
        success: exportData.success,
        message: exportData.success ? exportData.message : exportData.error,
        data: exportData.data,
      });
    } catch (error) {
      setResult({
        success: false,
        message: `エクスポートエラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card padding={4}>
      <Stack space={4}>
        <Text size={3} weight="bold">
          WordPress エクスポート
        </Text>

        <Text size={1} muted>
          SanityのランディングページをWordPressに投稿として出力します
        </Text>

        {/* ランディングページ選択 */}
        <Stack space={3}>
          <Text size={2} weight="semibold">
            ランディングページ
          </Text>
          <TextInput
            placeholder="スラッグを入力 (例: my-landing-page)"
            value={formData.slug}
            onChange={event => updateFormData('slug', event.currentTarget.value)}
          />
        </Stack>

        {/* WordPress認証情報 */}
        <Stack space={3}>
          <Text size={2} weight="semibold">
            WordPress設定
          </Text>

          <TextInput
            placeholder="WordPress サイトURL (例: https://mysite.com)"
            value={formData.wordpressSiteUrl}
            onChange={event => updateFormData('wordpressSiteUrl', event.currentTarget.value)}
          />

          <TextInput
            placeholder="ユーザー名"
            value={formData.wordpressUsername}
            onChange={event => updateFormData('wordpressUsername', event.currentTarget.value)}
          />

          <TextInput
            placeholder="アプリケーションパスワード"
            type="password"
            value={formData.wordpressAppPassword}
            onChange={event => updateFormData('wordpressAppPassword', event.currentTarget.value)}
          />

          <Select
            value={formData.publishStatus}
            onChange={event => updateFormData('publishStatus', event.currentTarget.value)}
          >
            <option value="draft">下書き</option>
            <option value="publish">公開</option>
          </Select>

          {/* 既存投稿を更新するかどうかのチェックボックス */}
          <Flex align="center" gap={2}>
            <Checkbox
              checked={formData.updateExisting}
              onChange={event => updateFormData('updateExisting', event.currentTarget.checked)}
            />
            <Text size={1}>同じスラッグの既存投稿があれば更新する（新規作成ではなく）</Text>
          </Flex>
        </Stack>

        {/* アクション */}
        <Flex gap={2}>
          <Button
            text="接続テスト"
            onClick={testConnection}
            loading={isLoading}
            mode="ghost"
            tone="primary"
          />
          <Button
            text="WordPressにエクスポート"
            onClick={exportToWordPress}
            loading={isLoading}
            tone="positive"
          />
        </Flex>

        {/* 接続テスト結果 */}
        {testResult && (
          <Card padding={3} tone={testResult.success ? 'positive' : 'critical'}>
            <Stack space={2}>
              <Text size={1} weight="semibold">
                接続テスト結果
              </Text>
              <Text size={1}>{testResult.message}</Text>
              {testResult.siteInfo && (
                <Stack space={1}>
                  <Text size={1} muted>
                    サイト名: {testResult.siteInfo.name}
                  </Text>
                  <Text size={1} muted>
                    URL: {testResult.siteInfo.url}
                  </Text>
                </Stack>
              )}
            </Stack>
          </Card>
        )}

        {/* エクスポート結果 */}
        {result && (
          <Card padding={3} tone={result.success ? 'positive' : 'critical'}>
            <Stack space={2}>
              <Text size={1} weight="semibold">
                エクスポート結果
              </Text>
              <Text size={1}>{result.message}</Text>
              {result.success && result.data && (
                <Stack space={1}>
                  <Text size={1} muted>
                    投稿ID: {result.data.postId}
                  </Text>
                  <Text size={1} muted>
                    ステータス: {result.data.status}
                  </Text>
                  <Text size={1} muted>
                    アクション: {result.data.action === 'updated' ? '更新' : '新規作成'}
                  </Text>
                  {result.data.existingPost && (
                    <Text size={1} muted>
                      更新した投稿: {result.data.existingPost.title}
                    </Text>
                  )}
                  {result.data.postUrl && (
                    <Text size={1}>
                      <a
                        href={result.data.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#0066cc' }}
                      >
                        投稿を表示 →
                      </a>
                    </Text>
                  )}
                </Stack>
              )}
            </Stack>
          </Card>
        )}

        {/* 使用方法 */}
        <Card padding={3} tone="primary">
          <Stack space={2}>
            <Text size={1} weight="semibold">
              使用方法
            </Text>
            <Stack space={1}>
              <Text size={1}>1. WordPressでアプリケーションパスワードを生成</Text>
              <Text size={1}>2. エクスポートしたいランディングページのスラッグを入力</Text>
              <Text size={1}>3. WordPress認証情報を入力</Text>
              <Text size={1}>4. 既存投稿の更新が必要な場合はチェックボックスを有効にする</Text>
              <Text size={1}>5. 接続テストを実行して確認</Text>
              <Text size={1}>6. エクスポートを実行</Text>
            </Stack>
          </Stack>
        </Card>
      </Stack>
    </Card>
  );
}

// プラグイン定義
export const wordpressExportPlugin = definePlugin({
  name: 'wordpress-export',
  tools: [
    {
      name: 'wordpress-export',
      title: 'WordPress エクスポート',
      component: WordPressExportTool,
    } as Tool,
  ],
});
