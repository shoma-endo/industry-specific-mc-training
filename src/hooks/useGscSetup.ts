import { useCallback, useEffect, useState } from 'react';
import type { GscConnectionStatus, GscSiteEntry } from '@/types/gsc';
import {
  fetchGscProperties,
  fetchGscStatus,
} from '@/server/actions/gscSetup.actions';
import { isTokenExpiredError } from '@/domain/errors/gsc-error-handlers';

interface UseGscSetupResult {
  status: GscConnectionStatus;
  properties: GscSiteEntry[];
  needsReauth: boolean;
  isSyncingStatus: boolean;
  isLoadingProperties: boolean;
  alertMessage: string | null;
  setStatus: (status: GscConnectionStatus) => void;
  setProperties: (properties: GscSiteEntry[]) => void;
  setAlertMessage: (message: string | null) => void;
  refreshStatus: () => Promise<void>;
  refetchProperties: () => Promise<void>;
}

/**
 * Google Search Console セットアップのロジックを管理する Custom Hook
 *
 * @param initialStatus - 初期接続ステータス
 */
export function useGscSetup(initialStatus: GscConnectionStatus): UseGscSetupResult {
  const [status, setStatus] = useState<GscConnectionStatus>(initialStatus);
  const [properties, setProperties] = useState<GscSiteEntry[]>([]);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [isSyncingStatus, setIsSyncingStatus] = useState(false);
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);

  const refreshStatus = useCallback(async () => {
    setIsSyncingStatus(true);
    setAlertMessage(null);
    try {
      const result = await fetchGscStatus();
      if (result.success && result.data) {
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

  const refetchProperties = useCallback(async () => {
    if (!status.connected) return;
    setIsLoadingProperties(true);
    setAlertMessage(null);
    setNeedsReauth(false);
    try {
      const result = await fetchGscProperties();
      if (result.success && Array.isArray(result.data)) {
        setProperties(result.data as GscSiteEntry[]);
      } else {
        // Server Actionから再認証フラグが返された場合
        if ('needsReauth' in result && result.needsReauth) {
          setNeedsReauth(true);
          setAlertMessage(result.error || 'Googleアカウントの認証が期限切れまたは取り消されています');
        } else {
          setAlertMessage(result.error || 'プロパティ一覧の取得に失敗しました');
        }
      }
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'プロパティ一覧の取得に失敗しました';

      // トークン期限切れ/取り消しエラーの場合は再認証を促す
      if (isTokenExpiredError(errorMessage)) {
        setNeedsReauth(true);
        setAlertMessage('Googleアカウントの認証が期限切れまたは取り消されています。再認証してください。');
      } else {
        setAlertMessage(errorMessage);
      }
    } finally {
      setIsLoadingProperties(false);
    }
  }, [status.connected]);

  useEffect(() => {
    if (status.connected) {
      refetchProperties();
    } else {
      setProperties([]);
    }
  }, [status.connected, refetchProperties]);

  return {
    status,
    properties,
    needsReauth,
    isSyncingStatus,
    isLoadingProperties,
    alertMessage,
    setStatus,
    setProperties,
    setAlertMessage,
    refreshStatus,
    refetchProperties,
  };
}
