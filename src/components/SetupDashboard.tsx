'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Settings, Plug, Loader2, ShieldCheck, ShieldOff, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { SetupDashboardProps } from '@/types/components';
import { fetchGscStatus } from '@/server/actions/gscSetup.actions';

interface WordPressStatus {
  connected: boolean;
  status: 'connected' | 'error' | 'not_configured';
  message: string;
  wpType?: 'wordpress_com' | 'self_hosted';
  lastUpdated?: string;
}

export default function SetupDashboard({ wordpressSettings, gscStatus }: SetupDashboardProps) {
  const [wpStatus, setWpStatus] = useState<WordPressStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [gscConnection, setGscConnection] = useState(gscStatus);
  const [isLoadingGscStatus, setIsLoadingGscStatus] = useState(false);

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

  useEffect(() => {
    setGscConnection(gscStatus);
  }, [gscStatus]);

  const refetchGscStatus = useCallback(async () => {
    setIsLoadingGscStatus(true);
    try {
      const result = await fetchGscStatus();
      if (result.success && result.data) {
        setGscConnection(result.data);
      }
    } catch (error) {
      console.error('GSCステータス取得エラー:', error);
    } finally {
      setIsLoadingGscStatus(false);
    }
  }, []);

  useEffect(() => {
    refetchGscStatus();
  }, [refetchGscStatus]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-4">設定</h1>
        <p className="text-gray-600">各種サービス連携に必要な設定を管理します</p>
      </div>

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
                <div className="flex-1">
                  <Button
                    asChild
                    variant={wordpressSettings.hasSettings ? 'outline' : 'default'}
                    className={`w-full ${wordpressSettings.hasSettings ? 'border-2 border-gray-400 hover:border-gray-500' : ''}`}
                  >
                    <Link href="/setup/wordpress">
                      <Settings size={16} className="mr-2" />
                      {wordpressSettings.hasSettings ? '設定を編集' : '設定を開始'}
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Google Search Console 連携 */}
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
                  {gscConnection.connected ? (
                    <>
                      <CheckCircle className="text-green-500" size={20} />
                      <span className="text-green-700 font-medium">接続済み</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="text-orange-500" size={20} />
                      <span className="text-orange-700 font-medium">未設定</span>
                    </>
                  )}
                </div>
                {isLoadingGscStatus ? (
                  <div className="flex items-center gap-1">
                    <Loader2 className="animate-spin" size={14} />
                    <Badge variant="secondary" className="text-xs">
                      確認中
                    </Badge>
                  </div>
                ) : (
                  <Badge
                    variant={gscConnection.connected ? 'default' : 'secondary'}
                    className={`text-xs ${
                      gscConnection.connected
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {gscConnection.connected ? '接続OK' : '未接続'}
                  </Badge>
                )}
              </div>

              {gscConnection.connected ? (
                <div className="text-sm text-gray-600 space-y-1">
                  <p>アカウント: {gscConnection.googleAccountEmail ?? '取得中'}</p>
                  <p>
                    プロパティ:{' '}
                    {gscConnection.propertyDisplayName ?? gscConnection.propertyUri ?? '未選択'}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {gscConnection.permissionLevel && (
                      <Badge variant="outline">{gscConnection.permissionLevel}</Badge>
                    )}
                    {gscConnection.verified ? (
                      <Badge className="bg-green-100 text-green-800">
                        <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                        検証済み
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-600 border-red-300">
                        <ShieldOff className="h-3.5 w-3.5 mr-1" />
                        未検証
                      </Badge>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Search Consoleから検索パフォーマンス指標を取り込み、改善アクションに活用できます。</p>
                  <p className="text-xs text-gray-500">
                    所有者またはフルユーザー権限が必要です。連携後にプロパティを選択してください。
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <div className="flex-1">
                  <Button asChild variant={gscConnection.connected ? 'outline' : 'default'} className={`w-full ${gscConnection.connected ? 'border-2 border-gray-400 hover:border-gray-500' : ''}`}>
                    <Link href="/setup/gsc">
                      <Settings size={16} className="mr-2" />
                      {gscConnection.connected ? '連携を管理' : '連携を開始'}
                    </Link>
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchGscStatus}
                  disabled={isLoadingGscStatus}
                  className="flex items-center gap-1"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingGscStatus ? 'animate-spin' : ''}`} />
                  再読込
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 初回セットアップガイド */}
      {!wordpressSettings.hasSettings && (
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
              </ol>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
