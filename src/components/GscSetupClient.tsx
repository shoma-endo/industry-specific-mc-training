'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { GscConnectionStatus } from '@/types/gsc';
import type { Ga4ConnectionStatus } from '@/types/ga4';
import {
  ArrowLeft,
  Plug,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Unplug,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import {
  disconnectGsc,
  saveGscProperty,
} from '@/server/actions/gscSetup.actions';
import { saveGa4Settings } from '@/server/actions/ga4Setup.actions';
import { formatDate } from '@/lib/date-utils';
import { GscStatusBadge } from '@/components/ui/GscStatusBadge';
import { useGscSetup } from '@/hooks/useGscSetup';
import { useGa4Setup } from '@/hooks/useGa4Setup';
import { handleAsyncAction } from '@/lib/async-handler';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { useLiffContext } from '@/components/LiffProvider';

interface GscSetupClientProps {
  initialStatus: GscConnectionStatus;
  initialGa4Status: Ga4ConnectionStatus;
  isOauthConfigured: boolean;
}

const OAUTH_START_PATH = '/api/gsc/oauth/start';

export default function GscSetupClient({
  initialStatus,
  initialGa4Status,
  isOauthConfigured,
}: GscSetupClientProps) {
  const { user } = useLiffContext();
  const {
    status,
    properties,
    isSyncingStatus,
    isLoadingProperties,
    alertMessage,
    setStatus,
    setProperties,
    setAlertMessage,
    refreshStatus,
    refetchProperties,
  } = useGscSetup(initialStatus);
  const {
    status: ga4Status,
    properties: ga4Properties,
    keyEvents: ga4KeyEvents,
    isSyncingStatus: isGa4SyncingStatus,
    isLoadingProperties: isGa4LoadingProperties,
    isLoadingKeyEvents: isGa4LoadingKeyEvents,
    alertMessage: ga4AlertMessage,
    setStatus: setGa4Status,
    setAlertMessage: setGa4AlertMessage,
    refreshStatus: refreshGa4Status,
    refetchProperties: refetchGa4Properties,
    refetchKeyEvents,
  } = useGa4Setup(initialGa4Status);

  const isStaffUser = Boolean(user?.ownerUserId);
  // Setup画面は閲覧モード対象外（オーナーは常に操作可能）
  const isReadOnly = isStaffUser;
  const needsReauth = status.needsReauth ?? false;
  const canImport = !isReadOnly && status.connected && Boolean(status.propertyUri) && !needsReauth;

  const [isUpdatingProperty, setIsUpdatingProperty] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSavingGa4, setIsSavingGa4] = useState(false);
  const [isGa4Syncing, setIsGa4Syncing] = useState(false);

  const [selectedGa4PropertyId, setSelectedGa4PropertyId] = useState(
    ga4Status.propertyId ?? ''
  );
  const [selectedGa4Events, setSelectedGa4Events] = useState<string[]>(
    ga4Status.conversionEvents ?? []
  );
  const [ga4EngagementThreshold, setGa4EngagementThreshold] = useState<string>(
    ga4Status.thresholdEngagementSec != null ? String(ga4Status.thresholdEngagementSec) : ''
  );
  const [ga4ReadRateThreshold, setGa4ReadRateThreshold] = useState<string>(
    ga4Status.thresholdReadRate != null ? String(ga4Status.thresholdReadRate) : ''
  );

  const connectedProperty = useMemo(() => {
    if (!status.propertyUri) return null;
    return properties.find(property => property.siteUrl === status.propertyUri) ?? null;
  }, [status.propertyUri, properties]);

  const connectedGa4Property = useMemo(() => {
    if (!selectedGa4PropertyId) return null;
    return ga4Properties.find(property => property.propertyId === selectedGa4PropertyId) ?? null;
  }, [selectedGa4PropertyId, ga4Properties]);

  const ga4NeedsReauth = ga4Status.needsReauth ?? false;
  const ga4ScopeMissing = ga4Status.scopeMissing ?? false;

  const selectValueProps: { value?: string } = status.propertyUri
    ? { value: status.propertyUri }
    : {};

  const handlePropertyChange = async (value: string) => {
    const selected = properties.find(property => property.siteUrl === value);
    await handleAsyncAction(
      () =>
        saveGscProperty({
          propertyUri: value,
          permissionLevel: selected?.permissionLevel ?? null,
        }),
      {
        onSuccess: data => {
          setStatus(data as GscConnectionStatus);
          setAlertMessage('プロパティを保存しました');
        },
        setLoading: setIsUpdatingProperty,
        setMessage: setAlertMessage,
        defaultErrorMessage: 'プロパティの保存に失敗しました',
      }
    );
  };

  const handleDisconnect = async () => {
    await handleAsyncAction(disconnectGsc, {
      onSuccess: () => {
        setStatus({ connected: false });
        setProperties([]);
        setAlertMessage('Google Search Consoleとの連携を解除しました');
      },
      setLoading: setIsDisconnecting,
      setMessage: setAlertMessage,
      defaultErrorMessage: '連携解除に失敗しました',
    });
  };

  const handleGa4PropertyChange = (value: string) => {
    setSelectedGa4PropertyId(value);
    setSelectedGa4Events([]);
  };

  const handleGa4EventToggle = (eventName: string, checked: boolean) => {
    setSelectedGa4Events(prev => {
      if (checked) {
        return Array.from(new Set([...prev, eventName]));
      }
      return prev.filter(name => name !== eventName);
    });
  };

  const handleSaveGa4Settings = async () => {
    const parsedEngagement =
      ga4EngagementThreshold.trim() === '' ? undefined : Number(ga4EngagementThreshold);
    const parsedReadRate =
      ga4ReadRateThreshold.trim() === '' ? undefined : Number(ga4ReadRateThreshold);
    const thresholdEngagement = Number.isNaN(parsedEngagement) ? undefined : parsedEngagement;
    const thresholdReadRate = Number.isNaN(parsedReadRate) ? undefined : parsedReadRate;

    await handleAsyncAction(
      () =>
        saveGa4Settings({
          propertyId: selectedGa4PropertyId,
          propertyName: connectedGa4Property?.displayName ?? undefined,
          conversionEvents: selectedGa4Events,
          thresholdEngagementSec: thresholdEngagement,
          thresholdReadRate,
        }),
      {
        onSuccess: data => {
          setGa4Status(data as Ga4ConnectionStatus);
          setGa4AlertMessage('GA4設定を保存しました');
        },
        setLoading: setIsSavingGa4,
        setMessage: setGa4AlertMessage,
        defaultErrorMessage: 'GA4設定の保存に失敗しました',
      }
    );
  };

  const handleGa4ManualSync = async () => {
    await handleAsyncAction(
      async () => {
        const response = await fetch('/api/ga4/sync', { method: 'POST' });
        const json = (await response.json()) as { success: boolean; error?: string };
        if (!json.success) {
          throw new Error(json.error || 'GA4同期に失敗しました');
        }
        return json;
      },
      {
        onSuccess: () => {
          setGa4AlertMessage('GA4同期を開始しました');
        },
        setLoading: setIsGa4Syncing,
        setMessage: setGa4AlertMessage,
        defaultErrorMessage: 'GA4同期に失敗しました',
      }
    );
  };

  useEffect(() => {
    if (ga4Status.propertyId) {
      setSelectedGa4PropertyId(ga4Status.propertyId);
    }
    if (Array.isArray(ga4Status.conversionEvents)) {
      setSelectedGa4Events(ga4Status.conversionEvents);
    }
    if (ga4Status.thresholdEngagementSec != null) {
      setGa4EngagementThreshold(String(ga4Status.thresholdEngagementSec));
    }
    if (ga4Status.thresholdReadRate != null) {
      setGa4ReadRateThreshold(String(ga4Status.thresholdReadRate));
    }
  }, [ga4Status]);

  useEffect(() => {
    if (selectedGa4PropertyId) {
      refetchKeyEvents(selectedGa4PropertyId);
    }
  }, [selectedGa4PropertyId, refetchKeyEvents]);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
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
          <Plug className="text-red-500" size={32} />
          <h1 className="text-3xl font-bold">Google Search Console 連携</h1>
        </div>
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
            <code className="font-mono text-xs">GOOGLE_SEARCH_CONSOLE_REDIRECT_URI</code>{' '}
            を設定した上で再デプロイしてください。
          </p>
        </div>
      )}

      {/* 再認証が必要な場合の警告パネル */}
      {needsReauth && (
        <div className="rounded-lg border border-orange-300 bg-orange-50 p-4 space-y-3">
          <div className="flex items-center gap-2 text-orange-800">
            <AlertTriangle className="h-5 w-5" />
            <p className="font-semibold">Googleアカウントの再認証が必要です</p>
          </div>
          <div className="text-sm text-orange-700 space-y-2">
            <p>認証トークンが期限切れまたは取り消されています。再認証してください。</p>
            <div>
              <p className="font-medium">考えられる理由:</p>
              <ul className="list-disc list-inside ml-2 mt-1">
                <li>長期間アクセスがなかった</li>
                <li>Googleアカウント側でアプリの連携を解除した</li>
                <li>Googleアカウントのパスワードを変更した</li>
              </ul>
            </div>
            <p className="text-sm text-orange-700">
              「連携ステータス」カード内の「Googleでログイン」ボタンから再認証してください。
            </p>
          </div>
        </div>
      )}

      {/* 通常のアラートメッセージ */}
      {alertMessage && !needsReauth && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          {alertMessage}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-semibold">連携ステータス</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshStatus}
            disabled={isSyncingStatus || isReadOnly}
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
              <GscStatusBadge connected={status.connected} needsReauth={needsReauth} />
            </div>
            {isOauthConfigured ? (
              isReadOnly ? (
                <Button disabled variant="outline">
                  オーナーのみ操作できます
                </Button>
              ) : (
                <GoogleSignInButton href={OAUTH_START_PATH}>Googleでログイン</GoogleSignInButton>
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
                  <Badge variant="outline">最終更新: {formatDate(status.updatedAt)}</Badge>
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
                disabled={
                  isReadOnly || isLoadingProperties || isUpdatingProperty || properties.length === 0
                }
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
                          {property.propertyType === 'sc-domain'
                            ? ' · ドメイン'
                            : ' · URLプレフィックス'}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-gray-500">
                {isLoadingProperties && 'プロパティ一覧を取得中です...'}
                {!isLoadingProperties && properties.length === 0 && (
                  <span>
                    権限のあるプロパティが見つかりません。Google Search
                    Console側で権限を確認してください。
                  </span>
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
                  {connectedProperty.propertyType === 'sc-domain'
                    ? 'ドメインプロパティ'
                    : 'URLプレフィックス'}
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
                onClick={refetchProperties}
                disabled={isReadOnly || isLoadingProperties}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingProperties ? 'animate-spin' : ''}`} />
                プロパティ再取得
              </Button>
              {!canImport ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled
                  className="flex items-center gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  Google Search Console 日次指標インポート
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  className="flex items-center gap-2 text-blue-600 border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Link href="/gsc-import">
                    <BarChart3 className="h-4 w-4" />
                    Google Search Console 日次指標インポート
                  </Link>
                </Button>
              )}
              {!canImport && (
                <p className="text-xs text-gray-500">
                  {needsReauth
                    ? '再認証が必要なため、インポートは無効です。'
                    : !status.connected
                      ? 'GSC未接続のため、インポートは無効です。'
                      : !status.propertyUri
                        ? 'プロパティを選択して保存してください。'
                        : '読み取り専用のため、インポートは無効です。'}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={handleDisconnect}
                disabled={isReadOnly || isDisconnecting}
                className="flex items-center gap-2 text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700"
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
              <li>上部の「Googleでログイン」ボタンを押してOAuth認可を完了します。</li>
              <li>権限が確認でき次第、利用可能なプロパティが自動的に表示されます。</li>
            </ol>
            <p className="text-xs text-gray-500">
              Search
              Consoleで権限を付与する際は、サイト全体の「所有者」または「フルユーザー」権限が必要です。
            </p>
          </CardContent>
        </Card>
      )}

      {/* GA4 再認証が必要な場合の警告パネル */}
      {ga4NeedsReauth && (
        <div className="rounded-lg border border-orange-300 bg-orange-50 p-4 space-y-3">
          <div className="flex items-center gap-2 text-orange-800">
            <AlertTriangle className="h-5 w-5" />
            <p className="font-semibold">GA4の再認証が必要です</p>
          </div>
          <div className="text-sm text-orange-700 space-y-2">
            <p>
              GA4の権限が不足しているか、認証トークンが期限切れ/取り消しされています。再認証してください。
            </p>
            {ga4ScopeMissing && (
              <p className="text-sm text-orange-700">
                GA4の読み取り権限を追加するため、再認証が必要です。
              </p>
            )}
          </div>
        </div>
      )}

      {ga4AlertMessage && !ga4NeedsReauth && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          {ga4AlertMessage}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-semibold">GA4 連携ステータス</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={refetchGa4Properties}
            disabled={isGa4LoadingProperties || isReadOnly}
            className="flex items-center gap-1"
          >
            <RefreshCw className={`h-4 w-4 ${isGa4LoadingProperties ? 'animate-spin' : ''}`} />
            再読込
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-gray-500">現在の状態</span>
              <Badge variant={ga4Status.connected ? 'secondary' : 'outline'}>
                {ga4Status.connected ? '接続OK' : '未設定'}
              </Badge>
            </div>
            {isOauthConfigured ? (
              isReadOnly ? (
                <Button disabled variant="outline">
                  オーナーのみ操作できます
                </Button>
              ) : (
                <GoogleSignInButton asChild>
                  <a href={OAUTH_START_PATH}>Googleでログイン</a>
                </GoogleSignInButton>
              )
            ) : (
              <Button disabled variant="outline">
                OAuth設定が無効です
              </Button>
            )}
          </div>

          {ga4Status.connected && (
            <div className="grid gap-3 text-sm text-gray-700">
              <div>
                <span className="font-medium text-gray-500 block">接続プロパティ</span>
                <span>{ga4Status.propertyName ?? ga4Status.propertyId ?? '未選択'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500 block">CVイベント数</span>
                <span>{ga4Status.conversionEvents?.length ?? 0}件</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {ga4Status.lastSyncedAt && (
                  <Badge variant="outline">最終同期: {formatDate(ga4Status.lastSyncedAt)}</Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">GA4 設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <span className="text-sm font-medium text-gray-700">プロパティ</span>
            <Select
              value={selectedGa4PropertyId || ''}
              onValueChange={handleGa4PropertyChange}
              disabled={isReadOnly || isGa4LoadingProperties || ga4Properties.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="GA4プロパティを選択" />
              </SelectTrigger>
              <SelectContent>
                {ga4Properties.map(property => (
                  <SelectItem key={property.propertyId} value={property.propertyId}>
                    <div className="flex flex-col">
                      <span>{property.displayName}</span>
                      <span className="text-xs text-gray-500">{property.propertyId}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-gray-500">
              {isGa4LoadingProperties && 'GA4プロパティ一覧を取得中です...'}
              {!isGa4LoadingProperties && ga4Properties.length === 0 && (
                <span>権限のあるGA4プロパティが見つかりません。</span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium text-gray-700">前段CVイベント</span>
            <p className="text-xs text-gray-500">
              GA4のキーイベントから前段CVとして扱うイベントを選択してください（scroll_90は自動保存）。
            </p>
            <div className="rounded-md border border-gray-200 p-3 space-y-2">
              {isGa4LoadingKeyEvents ? (
                <p className="text-xs text-gray-500">キーイベントを取得中です...</p>
              ) : ga4KeyEvents.length === 0 ? (
                <p className="text-xs text-gray-500">選択可能なキーイベントがありません。</p>
              ) : (
                ga4KeyEvents.map(event => (
                  <div key={event.eventName} className="flex items-center gap-2">
                    <Checkbox
                      id={`ga4-event-${event.eventName}`}
                      checked={selectedGa4Events.includes(event.eventName)}
                      onCheckedChange={checked =>
                        handleGa4EventToggle(event.eventName, Boolean(checked))
                      }
                      disabled={isReadOnly}
                    />
                    <Label htmlFor={`ga4-event-${event.eventName}`} className="text-sm">
                      {event.eventName}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ga4-engagement-threshold">滞在時間の閾値（秒）</Label>
              <Input
                id="ga4-engagement-threshold"
                type="number"
                value={ga4EngagementThreshold}
                onChange={event => setGa4EngagementThreshold(event.target.value)}
                disabled={isReadOnly}
                placeholder="例: 60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ga4-readrate-threshold">読了率の閾値（0〜1）</Label>
              <Input
                id="ga4-readrate-threshold"
                type="number"
                step="0.01"
                value={ga4ReadRateThreshold}
                onChange={event => setGa4ReadRateThreshold(event.target.value)}
                disabled={isReadOnly}
                placeholder="例: 0.4"
              />
            </div>
          </div>

          {connectedGa4Property && (
            <div className="rounded-md bg-gray-50 p-4 text-sm text-gray-700 space-y-1">
              <div>
                <span className="font-medium">プロパティ:</span> {connectedGa4Property.displayName}
              </div>
              <div>
                <span className="font-medium">ID:</span> {connectedGa4Property.propertyId}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={refreshGa4Status}
              disabled={isReadOnly || isGa4SyncingStatus}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isGa4SyncingStatus ? 'animate-spin' : ''}`} />
              ステータス再取得
            </Button>
            <Button
              type="button"
              onClick={handleSaveGa4Settings}
              disabled={isReadOnly || isSavingGa4 || !selectedGa4PropertyId}
              className="flex items-center gap-2"
            >
              保存
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleGa4ManualSync}
              disabled={isReadOnly || isGa4Syncing || !selectedGa4PropertyId}
              className="flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              GA4日次同期を実行
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 設定ガイド */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Google Search Console 連携ガイド</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6 text-sm text-gray-700">
            {/* 連携手順 */}
            <div>
              <h4 className="font-medium mb-2">連携手順</h4>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Search Consoleで対象サイトを登録し、所有者ステータスを確認</li>
                <li>上部の「Googleでログイン」ボタンでOAuth認可を完了</li>
                <li>権限が確認でき次第、利用可能なプロパティが自動表示されます</li>
                <li>プロパティを選択して保存</li>
              </ol>
            </div>

            {/* 必要な権限 */}
            <div>
              <h4 className="font-medium mb-2">必要な権限</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Search Consoleでサイト全体の「所有者」または「フルユーザー」権限が必要です</li>
                <li>
                  読み取り専用スコープ（webmasters.readonly / analytics.readonly）を使用します
                </li>
                <li>データの書き込み・削除は一切行いません</li>
              </ul>
            </div>

            {/* トラブルシューティング */}
            <div>
              <h4 className="font-medium mb-2">トラブルシューティング</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>プロパティが表示されない → Search Console側で権限を確認してください</li>
                <li>接続エラーが出る → 再読込ボタンで最新状態を取得してください</li>
                <li>認証がうまくいかない → 一度連携解除してから再度認証してください</li>
              </ul>
            </div>

            {/* 参考リンク */}
            <div>
              <h4 className="font-medium mb-2">参考リンク</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  <a
                    href="https://support.google.com/webmasters/answer/7687615?hl=ja"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    所有者、ユーザー、権限の管理
                  </a>
                </li>
                <li>
                  <a
                    href="https://support.google.com/webmasters/answer/6258314?hl=ja"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Search Console の基本的な使用方法
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
