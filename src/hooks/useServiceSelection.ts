'use client';

import { useState, useEffect, useCallback } from 'react';
import { getBrief } from '@/server/actions/brief.actions';
import {
  getSessionServiceIdSA,
  updateSessionServiceIdSA,
} from '@/server/actions/chat.actions';
import type { Service } from '@/server/schemas/brief.schema';

/**
 * サービス選択の状態
 */
export interface ServiceSelectionState {
  /** サービス一覧 */
  services: Service[];
  /** 選択中のサービスID */
  selectedServiceId: string | null;
  /** サービス一覧を取得中かどうか */
  isServicesLoading: boolean;
  /** サービスIDを取得中かどうか */
  isServiceIdLoading: boolean;
}

/**
 * サービス選択のアクション
 */
export interface ServiceSelectionActions {
  /** サービスを変更（既存セッションの場合はDBも更新） */
  changeService: (serviceId: string) => Promise<void>;
}

/**
 * useServiceSelection フックの戻り値
 */
export interface ServiceSelectionHook {
  state: ServiceSelectionState;
  actions: ServiceSelectionActions;
}

/**
 * useServiceSelection フックのオプション
 */
interface UseServiceSelectionOptions {
  /** アクセストークン取得関数 */
  getAccessToken: () => Promise<string>;
  /** 現在のセッションID（null の場合は新規チャット） */
  currentSessionId: string | null;
}

/**
 * サービス選択ロジックを管理するカスタムフック
 *
 * @description
 * - 事業者情報からサービス一覧を取得
 * - セッション切り替え時に適切なサービスIDを設定
 * - サービス変更時にDBへの永続化を実行
 */
export function useServiceSelection({
  getAccessToken,
  currentSessionId,
}: UseServiceSelectionOptions): ServiceSelectionHook {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [isServicesLoading, setIsServicesLoading] = useState(true);
  const [isServiceIdLoading, setIsServiceIdLoading] = useState(false);

  // 事業者情報（サービス一覧）の取得
  useEffect(() => {
    let isActive = true;
    setIsServicesLoading(true);

    const loadBrief = async () => {
      try {
        const accessToken = await getAccessToken();
        const res = await getBrief(accessToken);
        if (isActive && res.success && res.data) {
          setServices(res.data.services || []);
        } else if (isActive && !res.success) {
          console.error('事業者情報の取得に失敗しました:', res.error);
        }
      } catch (error) {
        if (isActive) {
          console.error('事業者情報の取得エラー:', error);
        }
      } finally {
        if (isActive) {
          setIsServicesLoading(false);
        }
      }
    };

    loadBrief();

    return () => {
      isActive = false;
    };
  }, [getAccessToken]);

  // セッション切替時にサービスIDを取得
  useEffect(() => {
    // サービス一覧の取得が完了するまで待機
    if (isServicesLoading) {
      return;
    }

    let isActive = true;
    setIsServiceIdLoading(true);

    const fetchSessionServiceId = async () => {
      if (!currentSessionId) {
        // 新規チャットの場合は最初のサービスを選択
        if (services.length > 0 && services[0]) {
          setSelectedServiceId(services[0].id);
        } else {
          setSelectedServiceId(null);
        }
        setIsServiceIdLoading(false);
        return;
      }

      try {
        const accessToken = await getAccessToken();
        const result = await getSessionServiceIdSA(currentSessionId, accessToken);
        if (!isActive) {
          return;
        }
        if (result.success && result.data) {
          setSelectedServiceId(result.data);
        } else if (services.length > 0 && services[0]) {
          // サービスIDが未設定の場合は最初のサービスを選択
          setSelectedServiceId(services[0].id);
        } else {
          setSelectedServiceId(null);
        }
      } catch (error) {
        console.error('Failed to fetch session service ID:', error);
        // エラー時も最初のサービスにフォールバック
        if (services.length > 0 && services[0]) {
          setSelectedServiceId(services[0].id);
        }
      } finally {
        if (isActive) {
          setIsServiceIdLoading(false);
        }
      }
    };

    fetchSessionServiceId();

    return () => {
      isActive = false;
    };
  }, [currentSessionId, services, isServicesLoading, getAccessToken]);

  // サービス変更時の処理（既存セッションの場合はDBも更新）
  const changeService = useCallback(
    async (serviceId: string) => {
      setSelectedServiceId(serviceId);

      // 既存セッションの場合はDBを更新
      if (currentSessionId) {
        try {
          const accessToken = await getAccessToken();
          await updateSessionServiceIdSA(currentSessionId, serviceId, accessToken);
        } catch (error) {
          console.error('Failed to update session service ID:', error);
        }
      }
    },
    [currentSessionId, getAccessToken]
  );

  return {
    state: {
      services,
      selectedServiceId,
      isServicesLoading,
      isServiceIdLoading,
    },
    actions: {
      changeService,
    },
  };
}
