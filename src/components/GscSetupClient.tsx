'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { GscConnectionStatus, GscSiteEntry } from '@/types/googleSearchConsole';
import {
  AlertCircle,
  CheckCircle2,
  Plug,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Unplug,
} from 'lucide-react';

interface GscSetupClientProps {
  initialStatus: GscConnectionStatus;
  isOauthConfigured: boolean;
}

const OAUTH_START_PATH = '/api/gsc/oauth/start';

const formatDate = (value?: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const statusBadge = (connected: boolean) => {
  if (connected) {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
        <CheckCircle2 className="mr-1 h-4 w-4" />
        接続済み
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-gray-700">
      <AlertCircle className="mr-1 h-4 w-4" />
      未接続
    </Badge>
  );
};

export default function GscSetupClient({ initialStatus, isOauthConfigured }: GscSetupClientProps) {
  const [status, setStatus] = useState<GscConnectionStatus>(initialStatus);
  const [properties, setProperties] = useState<GscSiteEntry[]>([]);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [isSyncingStatus, setIsSyncingStatus] = useState(false);
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);
  const [isUpdatingProperty, setIsUpdatingProperty] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const connectedProperty = useMemo(() => {
    if (!status.propertyUri) return null;
    return properties.find(property => property.siteUrl === status.propertyUri) ?? null;
  }, [status.propertyUri, properties]);

  const selectValueProps: { value?: string } = status.propertyUri ? { value: status.propertyUri } : {};

  const refreshStatus = useCallback(async () => {
    setIsSyncingStatus(true);
    setAlertMessage(null);
    try {
      const response = await fetch('/api/gsc/status', { credentials: 'include' });
      const result = await response.json();
      if (result.success) {
        setStatus(result.data as GscConnectionStatus);
      } else {
        throw new Error(result.error || 'ステータスの取得に失敗しました');
      }
    } catch (error) {
      console.error(error);
      setAlertMessage(
        error instanceof Error ? error.message : 'Google Search Consoleの状態取得に失敗しました'
      );
    } finally {
      setIsSyncingStatus(false);
    }
  }, []);

  const fetchProperties = useCallback(async () => {
    if (!status.connected) return;
    setIsLoadingProperties(true);
    setAlertMessage(null);
    try {
      const response = await fetch('/api/gsc/properties', { credentials: 'include' });
      const result = await response.json();
      if (result.success) {
        setProperties(result.data as GscSiteEntry[]);
      } else {
        throw new Error(result.error || 'プロパティ一覧の取得に失敗しました');
      }
    } catch (error) {
      console.error(error);
      setAlertMessage(
        error instanceof Error ? error.message : 'プロパティ一覧の取得に失敗しました'
      );
    } finally {
      setIsLoadingProperties(false);
    }
  }, [status.connected]);

  useEffect(() => {
    if (status.connected) {
      fetchProperties();
    } else {
      setProperties([]);
    }
  }, [status.connected, fetchProperties]);

  const handlePropertyChange = async (value: string) => {
    setIsUpdatingProperty(true);
    setAlertMessage(null);
    try {
      const selected = properties.find(property => property.siteUrl === value);
      const response = await fetch('/api/gsc/property', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyUri: value,
          permissionLevel: selected?.permissionLevel,
        }),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'プロパティの保存に失敗しました');
      }
      setStatus(result.data as GscConnectionStatus);
      setAlertMessage('プロパティを保存しました');
    } catch (error) {
      console.error(error);
      setAlertMessage(
        error instanceof Error ? error.message : 'プロパティの保存に失敗しました'
      );
    } finally {
      setIsUpdatingProperty(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setAlertMessage(null);
    try {
      const response = await fetch('/api/gsc/disconnect', {
        method: 'POST',
        credentials: 'include',
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '連携解除に失敗しました');
      }
      setStatus({ connected: false });
      setProperties([]);
      setAlertMessage('Google Search Consoleとの連携を解除しました');
    } catch (error) {
      console.error(error);
      setAlertMessage(
        error instanceof Error ? error.message : '連携解除に失敗しました'
      );
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Google Search Console 連携</h1>
        <p className="text-gray-600">
          Google Search Consoleから検索パフォーマンス指標を取得し、広告・LP改善に活用します。
        </p>
      </div>

      {!isOauthConfigured && (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          <p className="font-semibold">環境変数が未設定のため連携を開始できません。</p>
          <p className="mt-1">
            管理者は <code className="font-mono text-xs">GOOGLE_OAUTH_CLIENT_ID</code>,{' '}
            <code className="font-mono text-xs">GOOGLE_OAUTH_CLIENT_SECRET</code>,{' '}
            <code className="font-mono text-xs">GOOGLE_SEARCH_CONSOLE_REDIRECT_URI</code> を設定した上で再デプロイしてください。
          </p>
        </div>
      )}

      {alertMessage && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          {alertMessage}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Plug className="text-red-500" size={20} />
            連携ステータス
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshStatus}
            disabled={isSyncingStatus}
            className="flex items-center gap-1"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncingStatus ? 'animate-spin' : ''}`} />
            再読込
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-gray-500">現在の状態</span>
              {statusBadge(status.connected)}
            </div>
            {isOauthConfigured ? (
              status.connected ? (
                <Button asChild variant="outline">
                  <a href={OAUTH_START_PATH}>再認証</a>
                </Button>
              ) : (
                <Button asChild>
                  <a href={OAUTH_START_PATH}>Googleアカウントで認証</a>
                </Button>
              )
            ) : (
              <Button disabled variant="outline">
                OAuth設定が無効です
              </Button>
            )}
          </div>

          {status.connected && (
            <div className="grid gap-3 text-sm text-gray-700">
              <div>
                <span className="font-medium text-gray-500 block">Googleアカウント</span>
                <span>{status.googleAccountEmail ?? '取得中...'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500 block">接続プロパティ</span>
                <span>{status.propertyDisplayName ?? status.propertyUri ?? '未選択'}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {status.permissionLevel && (
                  <Badge variant="secondary">
                    {status.permissionLevel === 'siteOwner' ? '所有者' : status.permissionLevel}
                  </Badge>
                )}
                {status.verified ? (
                  <Badge className="bg-green-100 text-green-800">
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                    検証済み
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-red-600 border-red-300">
                    <ShieldOff className="mr-1 h-3.5 w-3.5" />
                    未検証
                  </Badge>
                )}
                {status.updatedAt && (
                  <Badge variant="outline">
                    最終更新: {formatDate(status.updatedAt)}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {status.connected ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">プロパティ選択</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              権限を持つプロパティの中から、分析対象とするサイトを選択してください。
            </p>
            <div className="space-y-2">
              <span className="text-sm font-medium text-gray-700">プロパティ</span>
              <Select
                {...selectValueProps}
                onValueChange={handlePropertyChange}
                disabled={isLoadingProperties || isUpdatingProperty || properties.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="プロパティを選択" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map(property => (
                    <SelectItem key={property.siteUrl} value={property.siteUrl}>
                      <div className="flex flex-col">
                        <span>{property.displayName}</span>
                        <span className="text-xs text-gray-500">
                          {property.permissionLevel}
                          {property.propertyType === 'sc-domain' ? ' · ドメイン' : ' · URLプレフィックス'}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-gray-500">
                {isLoadingProperties && 'プロパティ一覧を取得中です...'}
                {!isLoadingProperties && properties.length === 0 && (
                  <span>権限のあるプロパティが見つかりません。Google Search Console側で権限を確認してください。</span>
                )}
              </div>
            </div>

            {connectedProperty && (
              <div className="rounded-md bg-gray-50 p-4 text-sm text-gray-700 space-y-1">
                <div>
                  <span className="font-medium">権限:</span> {connectedProperty.permissionLevel}
                </div>
                <div>
                  <span className="font-medium">種別:</span>{' '}
                  {connectedProperty.propertyType === 'sc-domain' ? 'ドメインプロパティ' : 'URLプレフィックス'}
                </div>
                <div>
                  <span className="font-medium">検証:</span>{' '}
                  {connectedProperty.verified ? '済み' : '未検証'}
                </div>
              </div>
            )}

            <div className="flex gap-3 flex-wrap">
              <Button
                type="button"
                variant="outline"
                onClick={fetchProperties}
                disabled={isLoadingProperties}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingProperties ? 'animate-spin' : ''}`} />
                プロパティ再取得
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="flex items-center gap-2"
              >
                <Unplug className="h-4 w-4" />
                連携解除
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">接続手順</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-gray-700">
            <ol className="list-decimal list-inside space-y-2">
              <li>Search Consoleで対象サイトを登録し、所有者ステータスを確認します。</li>
              <li>上部の「Googleアカウントで認証」ボタンを押してOAuth認可を完了します。</li>
              <li>権限が確認でき次第、利用可能なプロパティが自動的に表示されます。</li>
            </ol>
            <p className="text-xs text-gray-500">
              Search Consoleで権限を付与する際は、サイト全体の「所有者」または「フルユーザー」権限が必要です。
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
