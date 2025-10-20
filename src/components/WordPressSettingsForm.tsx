'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Plug, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { WordPressType } from '@/types/wordpress';
import type { WordPressSettingsFormProps } from '@/types/components';
import {
  saveWordPressSettingsAction,
  testWordPressConnectionAction,
} from '@/server/handler/actions/wordpress.action';

interface StatusOutcome {
  success: boolean;
  primary: string;
  cause?: string;
  hints?: string[];
  details?: string;
  needsOAuth?: boolean;
}

const StatusPanel: React.FC<{
  status: StatusOutcome;
  showDetails: boolean;
  onToggleDetails: () => void;
  onOAuthClick?: () => void;
}> = ({ status, showDetails, onToggleDetails, onOAuthClick }) => {
  const wrapperClasses = status.success
    ? 'bg-green-50 text-green-700'
    : 'bg-red-50 text-red-700';

  return (
    <div className={`p-4 rounded-lg ${wrapperClasses}`}>
      <div className="flex items-center gap-2">
        {status.success ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
        <p>{status.primary}</p>
      </div>

      {!status.success && (
        <div className="mt-2 space-y-2">
          {status.cause && (
            <p className="text-sm">
              <span className="font-semibold">原因:</span> {status.cause}
            </p>
          )}
          {status.hints && status.hints.length > 0 && (
            <div className="text-sm">
              <p className="font-semibold">対処方法:</p>
              <ul className="list-disc list-inside">
                {status.hints.map((hint, index) => (
                  <li key={index}>{hint}</li>
                ))}
              </ul>
            </div>
          )}
          {status.needsOAuth && onOAuthClick && (
            <Button type="button" variant="outline" onClick={onOAuthClick} className="mt-2">
              WordPress.com OAuth認証を開始
            </Button>
          )}
        </div>
      )}

      {status.details && (
        <div className="text-xs mt-2">
          <button type="button" className="underline" onClick={onToggleDetails}>
            {showDetails ? '詳細を隠す' : '詳細を表示'}
          </button>
          {showDetails && (
            <pre className="whitespace-pre-wrap break-words mt-1">{status.details}</pre>
          )}
        </div>
      )}
    </div>
  );
};

interface TestConnectionActionResult {
  success: boolean;
  message?: string;
  error?: string;
  needsWordPressAuth?: boolean;
}

function diagnoseErrorDetails(raw: string) {
  const lower = (raw || '').toLowerCase();
  if (!raw) {
    return {
      cause: '不明なエラー',
      hints: ['時間をおいて再試行してください', '状況が続く場合はサポートへ連絡してください'],
    };
  }
  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('token')) {
    return {
      cause: '認証エラー（トークンの欠如・期限切れ・無効）',
      hints: [
        'WordPress.comのOAuth認証をやり直してください',
        'セルフホストの場合はユーザー名/アプリパスワードを再確認してください',
      ],
    };
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return {
      cause: 'エンドポイント未検出またはサイトID/URL誤り',
      hints: [
        'WordPressサイトID（.com）またはサイトURL（セルフホスト）を確認してください',
        'REST APIが有効か（セルフホスト）確認してください',
      ],
    };
  }
  if (lower.includes('http') && lower.includes('settings')) {
    return {
      cause: 'REST API設定エンドポイントにアクセスできません',
      hints: [
        'Basic認証情報（ユーザー名/アプリパスワード）を確認してください',
        'セキュリティプラグイン等でREST APIがブロックされていないか確認してください',
      ],
    };
  }
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('timeout')) {
    return {
      cause: 'ネットワークエラー（接続失敗/タイムアウト）',
      hints: [
        'サイトURLのスペルやHTTPS有無を確認してください',
        '一時的な障害の可能性があります。時間を置いて再試行してください',
      ],
    };
  }
  return { cause: 'エラーが発生しました', hints: ['入力内容を確認し、再度お試しください'] };
}

export default function WordPressSettingsForm({
  existingSettings,
}: WordPressSettingsFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [saveStatus, setSaveStatus] = useState<StatusOutcome | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<StatusOutcome | null>(null);
  const [expandedPanel, setExpandedPanel] = useState<'save' | 'connection' | null>(null);

  // フォームの状態
  const [wpType, setWpType] = useState<WordPressType>(existingSettings?.wpType || 'wordpress_com');

  // WordPress.com用
  const [wpSiteId, setWpSiteId] = useState(existingSettings?.wpSiteId || '');

  // セルフホスト用
  const [wpSiteUrl, setWpSiteUrl] = useState(existingSettings?.wpSiteUrl || '');
  const [wpUsername, setWpUsername] = useState(existingSettings?.wpUsername || '');
  const [wpApplicationPassword, setWpApplicationPassword] = useState(
    existingSettings?.wpApplicationPassword || ''
  );

  // 保存済み設定が存在するか（接続テストは保存後のみ許可）
  const hasSavedSettings = Boolean(existingSettings);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // バリデーション
    if (wpType === 'wordpress_com' && !wpSiteId) {
      setSaveStatus({ success: false, primary: 'WordPress.comのサイトIDが必要です' });
      setExpandedPanel(prev => (prev === 'save' ? null : prev));
      return;
    }

    if (wpType === 'self_hosted' && (!wpSiteUrl || !wpUsername || !wpApplicationPassword)) {
      setSaveStatus({
        success: false,
        primary:
          'セルフホスト版では、サイトURL、ユーザー名、アプリケーションパスワードがすべて必要です',
      });
      setExpandedPanel(prev => (prev === 'save' ? null : prev));
      return;
    }

    setIsLoading(true);
    setSaveStatus(null);
    setExpandedPanel(prev => (prev === 'save' ? null : prev));

    try {
      const data = await saveWordPressSettingsAction({
        wpType,
        ...(wpType === 'wordpress_com'
          ? { wpSiteId }
          : { wpSiteUrl, wpUsername, wpApplicationPassword }),
      });

      if (data.success) {
        setSaveStatus({
          success: true,
          primary: existingSettings
            ? 'WordPress設定を更新しました'
            : 'WordPress設定を保存しました',
        });
        setExpandedPanel(prev => (prev === 'save' ? null : prev));

        // 少し遅延してからダッシュボードに戻る
        setTimeout(() => {
          router.push('/setup');
        }, 1500);
      } else {
        const details = data.error || '';
        const { cause, hints } = diagnoseErrorDetails(details);
        setSaveStatus({
          success: false,
          primary: data.error || 'WordPress設定の保存に失敗しました',
          details,
          cause,
          hints,
        });
      }
    } catch (error) {
      const details = error instanceof Error ? error.message : 'Unknown error';
      const { cause, hints } = diagnoseErrorDetails(details);
      setSaveStatus({
        success: false,
        primary: `エラーが発生しました: ${details}`,
        details,
        cause,
        hints,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const redirectToWordPressOAuth = () => {
    window.location.href = '/api/wordpress/oauth/start';
  };

  const handleTestConnection = async () => {
    // バリデーション
    if (wpType === 'wordpress_com' && !wpSiteId) {
      setConnectionStatus({ success: false, primary: 'WordPress.comのサイトIDが必要です' });
      setExpandedPanel(prev => (prev === 'connection' ? null : prev));
      return;
    }

    if (wpType === 'self_hosted' && (!wpSiteUrl || !wpUsername || !wpApplicationPassword)) {
      setConnectionStatus({
        success: false,
        primary:
          'セルフホスト版では、サイトURL、ユーザー名、アプリケーションパスワードがすべて必要です',
      });
      setExpandedPanel(prev => (prev === 'connection' ? null : prev));
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus(null);
    setExpandedPanel(prev => (prev === 'connection' ? null : prev));

    try {
      const data: TestConnectionActionResult = await testWordPressConnectionAction();

      if (data.success) {
        setConnectionStatus({
          success: true,
          primary: data.message || 'WordPress接続テストが成功しました',
        });
        setExpandedPanel(prev => (prev === 'connection' ? null : prev));
      } else {
        const details = data.error || '';
        const { cause, hints } = diagnoseErrorDetails(details);
        setConnectionStatus({
          success: false,
          primary: data.error || '接続テストに失敗しました',
          details,
          cause,
          hints,
          needsOAuth: Boolean(data.needsWordPressAuth),
        });
      }
    } catch (error) {
      const details = error instanceof Error ? error.message : 'Unknown error';
      const { cause, hints } = diagnoseErrorDetails(details);
      setConnectionStatus({
        success: false,
        primary: `接続テストでエラーが発生しました: ${details}`,
        details,
        cause,
        hints,
      });
    } finally {
      setIsTestingConnection(false);
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
          <CardTitle>{existingSettings ? 'WordPress設定を編集' : 'WordPress設定を追加'}</CardTitle>
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
                    placeholder="例: 123456789 または example.wordpress.com"
                    value={wpSiteId}
                    onChange={e => setWpSiteId(e.target.value)}
                    className="w-full"
                    required
                  />
                  <p className="text-xs text-gray-500">
                    数値のサイトID または サイトドメイン（example.wordpress.com /
                    example.com）のどちらでも入力できます
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
                    onChange={e => setWpSiteUrl(e.target.value)}
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
                    onChange={e => setWpUsername(e.target.value)}
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
                    placeholder="例: abcd efgh ijkl mnop qrst uvwx"
                    value={wpApplicationPassword}
                    onChange={e => setWpApplicationPassword(e.target.value)}
                    className="w-full"
                    required
                  />
                  <p className="text-xs text-gray-500">
                    WordPress管理画面で生成したアプリケーションパスワードを入力してください
                  </p>
                </div>
              </div>
            )}

            {/* 接続テスト結果表示 */}
            {connectionStatus && (
              <StatusPanel
                status={connectionStatus}
                showDetails={expandedPanel === 'connection'}
                onToggleDetails={() =>
                  setExpandedPanel(prev => (prev === 'connection' ? null : 'connection'))
                }
                {...(connectionStatus.needsOAuth
                  ? { onOAuthClick: redirectToWordPressOAuth }
                  : {})}
              />
            )}

            {/* 結果表示 */}
            {saveStatus && (
              <StatusPanel
                status={saveStatus}
                showDetails={expandedPanel === 'save'}
                onToggleDetails={() =>
                  setExpandedPanel(prev => (prev === 'save' ? null : 'save'))
                }
              />
            )}

            {/* アクションボタン */}
            <div className="space-y-4">
              <Button
                type="button"
                variant="secondary"
                onClick={handleTestConnection}
                disabled={isTestingConnection || !hasSavedSettings}
                className="w-full"
                title={hasSavedSettings ? undefined : '先に設定を保存してください'}
              >
                {isTestingConnection ? '接続テスト中...' : '接続テスト'}
              </Button>
              {!hasSavedSettings && (
                <p className="text-xs text-gray-500">
                  接続テストを行うには、先に設定を保存してください。
                </p>
              )}

              <div className="flex gap-4">
                <Link href="/setup" className="flex-1">
                  <Button type="button" variant="outline" className="w-full">
                    キャンセル
                  </Button>
                </Link>
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading ? '保存中...' : existingSettings ? '設定を更新' : '設定を保存'}
                </Button>
              </div>
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
                <li>生成されたパスワード（abcd efgh 形式）をコピー</li>
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

            {/* 参考リンク */}
            <div>
              <h4 className="font-medium mb-2">参考リンク</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  <a
                    href="https://knowledge.ablenet.jp/wordpress-initial-settings/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    WordPress初期設定マニュアル（カテゴリー・パーマリンクなど）
                  </a>
                </li>
                <li>
                  <a
                    href="https://cad-kenkyujo.com/wordpress-nyuumon/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    WordPress入門ガイド（テーマ・プラグインの基本）
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.value-domain.com/media/wordpress-initial-setting/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    WordPressの初期設定 23項目（画像設定・パーマリンク等）
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
