'use client';

import { useState } from 'react';
import liff from '@line/liff';
import { getLineProfileServer } from '@/server/handler/actions/login.actions';
import { getLineProfileServerResponse } from '@/server/handler/actions/login.actions';
import { env } from '@/env';
import { LiffError } from '@/domain/errors/LiffError';
import { LiffProfile, UseLiffResult } from '@/types/hooks';

// -----------------------------
// useLiff フック
// -----------------------------
export const useLiff = (): UseLiffResult => {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [liffObject, setLiffObject] = useState<typeof liff | null>(null);

  const clearError = () => setError(null);

  // -----------------------------
  // 明示的に呼び出す：LIFF初期化＆ログイン状態確認
  // -----------------------------
  const initLiff = async () => {
    if (liffObject) return;
    setIsLoading(true);

    try {
      const liffId = env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId) {
        throw LiffError.invalidLiffId(liffId);
      }

      await liff.init({ liffId });
      setLiffObject(liff);

      if (liff.isLoggedIn()) {
        setIsLoggedIn(true);

        try {
          const profileData = await liff.getProfile();
          setProfile({
            userId: profileData.userId,
            displayName: profileData.displayName,
            pictureUrl: profileData.pictureUrl || '',
            statusMessage: profileData.statusMessage || '',
          });
        } catch (profileError) {
          throw LiffError.profileFetchFailed(profileError);
        }
      } else {
        if (!liff.isInClient()) {
          liff.login({ redirectUri: window.location.href });
        }
      }
    } catch (initError) {
      console.error('LIFF initialization failed:', initError);
      
      // 認証コード無効エラーの場合は、URLパラメータをクリアして再試行
      if (initError instanceof Error && initError.message.includes('invalid authorization code')) {
        
        // URLパラメータをクリアして再試行
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        url.searchParams.delete('state');
        url.searchParams.delete('liffClientId');
        url.searchParams.delete('liffRedirectUri');
        window.history.replaceState({}, '', url.toString());
        
        // 少し待ってから再初期化を試行
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        
        setError('認証情報をリセットしています...');
        return;
      }
      
      const errorMessage =
        initError instanceof LiffError ? initError.userMessage : 'LIFFの初期化に失敗しました。';
      setError(errorMessage);
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
    try {
      const lineAccessToken = await getAccessToken();
      const profile = await getLineProfileServer(lineAccessToken);
      return profile;
    } catch (error) {
      throw LiffError.profileFetchFailed(error);
    }
  };

  // -----------------------------
  // アクセストークン取得（リフレッシュ対応）
  // -----------------------------
  const getAccessToken = async (): Promise<string> => {
    try {
      await liff.ready;
      const lineAccessToken = liff.getAccessToken() ?? '';

      if (!lineAccessToken) {
        throw LiffError.tokenExpired();
      }

      try {
        // サーバー側でトークンの検証とリフレッシュを実行
        const response = await fetch('/api/user/current');

        if (!response.ok) {
          throw LiffError.networkError(new Error(`HTTP ${response.status}`));
        }

        const data = await response.json();

        if (data.needsReauth) {
          console.warn('[LIFF] 再認証が必要です');
          liff.logout();
          liff.login({ redirectUri: window.location.href });
          throw LiffError.tokenExpired();
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

          if (!res.ok) {
            throw LiffError.networkError(new Error(`LINE API HTTP ${res.status}`));
          }

          const data = await res.json();

          if (data.expires_in < 0) {
            console.warn('[LIFF] トークン期限切れ、再ログインを実行');
            liff.logout();
            liff.login({ redirectUri: window.location.href });
            throw LiffError.tokenExpired();
          }
        } catch (verifyError) {
          console.warn('[LIFF] トークン確認失敗、再ログイン', verifyError);
          liff.logout();
          liff.login({ redirectUri: window.location.href });
          throw LiffError.tokenRefreshFailed(verifyError);
        }

        return lineAccessToken;
      }
    } catch (error) {
      if (error instanceof LiffError) {
        throw error;
      }
      throw LiffError.tokenRefreshFailed(error);
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
    clearError,
  };
};
