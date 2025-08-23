'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Settings, Plug, ArrowRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SetupDashboardProps } from '@/types/components';

interface WordPressStatus {
  connected: boolean;
  status: 'connected' | 'error' | 'not_configured';
  message: string;
  wpType?: 'wordpress_com' | 'self_hosted';
  lastUpdated?: string;
}

export default function SetupDashboard({ wordpressSettings }: SetupDashboardProps) {
  const router = useRouter();
  const [wpStatus, setWpStatus] = useState<WordPressStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  const isSetupComplete = wordpressSettings.hasSettings;

  // WordPress接続ステータスを取得
  useEffect(() => {
    const fetchWordPressStatus = async () => {
      if (!wordpressSettings.hasSettings) {
        setWpStatus({
          connected: false,
          status: 'not_configured',
          message: 'WordPress設定が未完了です',
        });
        return;
      }

      setIsLoadingStatus(true);
      try {
        const response = await fetch('/api/wordpress/status', {
          method: 'GET',
          credentials: 'include',
        });

        const result = await response.json();

        if (result.success) {
          setWpStatus(result.data);
        } else {
          setWpStatus({
            connected: false,
            status: 'error',
            message: result.error || 'ステータス取得に失敗しました',
          });
        }
      } catch (error) {
        console.error('WordPressステータス取得エラー:', error);
        setWpStatus({
          connected: false,
          status: 'error',
          message: 'WordPressステータス取得エラーが発生しました',
        });
      } finally {
        setIsLoadingStatus(false);
      }
    };

    fetchWordPressStatus();
  }, [wordpressSettings.hasSettings]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-4">設定</h1>
        <p className="text-gray-600">各種サービス連携や公開に必要な設定を管理します</p>
      </div>

      {/* 全体のステータス */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            {isSetupComplete ? (
              <>
                <CheckCircle className="text-green-500" size={24} />
                <h2 className="text-xl font-semibold text-green-700">設定完了</h2>
              </>
            ) : (
              <>
                <AlertCircle className="text-orange-500" size={24} />
                <h2 className="text-xl font-semibold text-orange-700">設定が必要です</h2>
              </>
            )}
          </div>
          <p className="text-gray-600 mb-4">
            {isSetupComplete
              ? 'すべての設定が完了しています。ランディングページ作成機能をご利用いただけます。'
              : '一部の設定が未完了です。下記の設定項目を確認してください。'}
          </p>

          {/* 利用可能な機能 */}
          <div className="space-y-3">
            {wordpressSettings.hasSettings && (
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-3">
                  <Plug className="text-purple-500" size={20} />
                  <div>
                    <span className="font-medium text-purple-800">ランディングページ作成</span>
                    <p className="text-sm text-purple-600">WordPress公開機能が利用可能</p>
                  </div>
                </div>
                <Button
                  onClick={() => router.push('/ad-form')}
                  size="sm"
                  variant="outline"
                  className="border-purple-300 text-purple-700 hover:bg-purple-100"
                >
                  開始
                  <ArrowRight size={16} className="ml-1" />
                </Button>
              </div>
            )}

            {isSetupComplete && (
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-3">
                  <CheckCircle className="text-green-500" size={20} />
                  <div>
                    <span className="font-medium text-green-800">フル機能</span>
                    <p className="text-sm text-green-600">すべての機能が利用可能です</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* サービス連携 */}
      <h2 className="text-xl font-semibold mb-3">サービス連携</h2>
      <div className="grid gap-6 md:grid-cols-1">
        {/* WordPress 設定 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Plug className="text-purple-500" size={24} />
              WordPress 設定
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {wordpressSettings.hasSettings ? (
                    <>
                      <CheckCircle className="text-green-500" size={20} />
                      <span className="text-green-700 font-medium">設定済み</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="text-orange-500" size={20} />
                      <span className="text-orange-700 font-medium">未設定</span>
                    </>
                  )}
                </div>

                {/* 接続ステータスバッジ */}
                {isLoadingStatus ? (
                  <div className="flex items-center gap-1">
                    <Loader2 className="animate-spin" size={14} />
                    <Badge variant="secondary" className="text-xs">
                      確認中
                    </Badge>
                  </div>
                ) : wpStatus ? (
                  <Badge
                    variant={
                      wpStatus.connected
                        ? 'default'
                        : wpStatus.status === 'not_configured'
                          ? 'secondary'
                          : 'destructive'
                    }
                    className={`text-xs ${
                      wpStatus.connected
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : wpStatus.status === 'not_configured'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                    }`}
                  >
                    {wpStatus.connected
                      ? '接続OK'
                      : wpStatus.status === 'not_configured'
                        ? '未設定'
                        : '接続エラー'}
                  </Badge>
                ) : null}
              </div>

              {wordpressSettings.hasSettings && (
                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    タイプ:{' '}
                    {wordpressSettings.type === 'wordpress_com' ? 'WordPress.com' : 'セルフホスト'}
                  </p>
                  {wordpressSettings.siteId && <p>サイトID: {wordpressSettings.siteId}</p>}
                  {wordpressSettings.siteUrl && <p>サイトURL: {wordpressSettings.siteUrl}</p>}

                  {/* 接続状態の詳細メッセージ */}
                  {wpStatus && wpStatus.status !== 'not_configured' && (
                    <div
                      className={`p-2 rounded text-xs ${
                        wpStatus.connected ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {wpStatus.message}
                    </div>
                  )}
                </div>
              )}

              <p className="text-sm text-gray-600">
                WordPressサイトと連携して、コンテンツの公開・更新を効率化します。
              </p>

              <div className="flex gap-2">
                <Link href="/setup/wordpress" className="flex-1">
                  <Button
                    variant={wordpressSettings.hasSettings ? 'outline' : 'default'}
                    className="w-full"
                  >
                    <Settings size={16} className="mr-2" />
                    {wordpressSettings.hasSettings ? '設定を編集' : '設定を開始'}
                  </Button>
                </Link>
                {wordpressSettings.hasSettings && (
                  <Button
                    onClick={() => router.push('/ad-form')}
                    variant="outline"
                    size="sm"
                    className="px-3"
                  >
                    <ArrowRight size={16} />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Google Search Console 連携（プレースホルダー） */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Plug className="text-red-500" size={24} />
              Google Search Console 連携
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="text-orange-500" size={20} />
                  <span className="text-orange-700 font-medium">未設定</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  準備中
                </Badge>
              </div>

              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  Google Search Consoleと連携して、サイトの検索パフォーマンスを分析・改善します。
                </p>
                <p className="text-xs text-gray-500">
                  連携にはGSCでのサイト登録と十分な権限（所有者など）が必要です。
                </p>
              </div>

              <div className="flex gap-2">
                <Link href="/setup/gsc" className="flex-1">
                  <Button className="w-full" disabled>
                    連携を開始
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 初回セットアップガイド */}
      {!isSetupComplete && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>初回セットアップガイド</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-gray-600">
                初めてご利用の場合は、以下の順序で設定を進めることをお勧めします
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                <li className={wordpressSettings.hasSettings ? 'line-through text-gray-400' : ''}>
                  <strong>WordPress設定</strong> - 公開先サイトの設定
                </li>
                <li className={isSetupComplete ? 'text-green-600 font-medium' : 'text-gray-400'}>
                  <strong>ランディングページ作成</strong> - AIによる自動生成とWordPress公開
                </li>
              </ol>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
