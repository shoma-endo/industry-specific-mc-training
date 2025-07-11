'use client';

import { useState } from 'react';
import liff from '@line/liff';
import { getLineProfileServer } from '@/server/handler/actions/login.actions';
import { getLineProfileServerResponse } from '@/server/handler/actions/login.actions';
import { env } from '@/env';

interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

interface UseLiffResult {
  isLoggedIn: boolean;
  isLoading: boolean;
  error: Error | null;
  liffObject: typeof liff | null;
  profile: LiffProfile | null;
  login: () => void;
  logout: () => void;
  getLineProfile: () => Promise<getLineProfileServerResponse>;
  getAccessToken: () => Promise<string>;
  initLiff: () => Promise<void>;
}

// -----------------------------
// useLiff フック
// -----------------------------
export const useLiff = (): UseLiffResult => {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [liffObject, setLiffObject] = useState<typeof liff | null>(null);

  // -----------------------------
  // 明示的に呼び出す：LIFF初期化＆ログイン状態確認
  // -----------------------------
  const initLiff = async () => {
    if (liffObject) return;
    setIsLoading(true);

    try {
      const liffId = env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId) {
        throw new Error('LIFF ID is not defined');
      }

      await liff.init({ liffId });
      setLiffObject(liff);

      if (liff.isLoggedIn()) {
        setIsLoggedIn(true);

        const profileData = await liff.getProfile();
        setProfile({
          userId: profileData.userId,
          displayName: profileData.displayName,
          pictureUrl: profileData.pictureUrl || '',
          statusMessage: profileData.statusMessage || '',
        });
      } else {
        if (!liff.isInClient()) {
          liff.login({ redirectUri: window.location.href });
        }
      }
    } catch (initError) {
      console.error('LIFF initialization failed (raw error object):', initError);
      setError(initError instanceof Error ? initError : new Error(String(initError)));
    } finally {
      setIsLoading(false);
    }
  };

  // -----------------------------
  // ログイン処理
  // -----------------------------
  const login = () => {
    liff.login({ redirectUri: window.location.href });
  };

  // -----------------------------
  // ログアウト処理
  // -----------------------------
  const logout = () => {
    if (!liff) return;
    liff.logout();
    setIsLoggedIn(false);
    setProfile(null);
    window.location.reload();
  };

  // -----------------------------
  // プロフィール取得（サーバーでトークンを検証）
  // -----------------------------
  const getLineProfile = async (): Promise<getLineProfileServerResponse> => {
    const lineAccessToken = await getAccessToken();
    const profile = await getLineProfileServer(lineAccessToken);
    return profile;
  };

  // -----------------------------
  // アクセストークン取得（リフレッシュ対応）
  // -----------------------------
  const getAccessToken = async (): Promise<string> => {
    await liff.ready;
    const lineAccessToken = liff.getAccessToken() ?? '';

    try {
      // サーバー側でトークンの検証とリフレッシュを実行
      const response = await fetch('/api/user/current');
      const data = await response.json();

      if (data.needsReauth) {
        console.warn('[LIFF] 再認証が必要です');
        liff.logout();
        liff.login({ redirectUri: window.location.href });
        throw new Error('Re-authentication required');
      }

      if (data.tokenRefreshed) {
        // LIFFオブジェクトのトークンも更新が必要な場合があります
        // （ただし、LIFF SDKは基本的にサーバーサイドのトークンと同期しないため、
        //  必要に応じて別の方法でトークンを管理する必要があります）
      }

      return lineAccessToken;
    } catch (fetchError) {
      console.warn(
        '[LIFF] サーバー側トークン確認失敗、フォールバックとしてクライアント側で確認',
        fetchError
      );

      // フォールバック：クライアント側でのトークン確認
      try {
        const res = await fetch(
          `https://api.line.me/oauth2/v2.1/verify?access_token=${lineAccessToken}`
        );
        const data = await res.json();

        if (!res.ok || data.expires_in < 0) {
          console.warn('[LIFF] トークン期限切れ、再ログインを実行');
          liff.logout();
          liff.login({ redirectUri: window.location.href });
          throw new Error('LINE access token is expired');
        }
      } catch (err) {
        console.warn('[LIFF] トークン確認失敗、再ログイン', err);
        liff.logout();
        liff.login({ redirectUri: window.location.href });
        throw err;
      }

      return lineAccessToken;
    }
  };

  // -----------------------------
  // 返却（構造はそのまま）
  // -----------------------------
  return {
    isLoggedIn,
    isLoading,
    error,
    liffObject,
    profile,
    login,
    logout,
    getLineProfile,
    getAccessToken,
    initLiff,
  };
};
