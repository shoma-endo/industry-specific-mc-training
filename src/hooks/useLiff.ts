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

        try {
          const profileData = await liff.getProfile();
          setProfile({
            userId: profileData.userId,
            displayName: profileData.displayName,
            pictureUrl: profileData.pictureUrl || '',
            statusMessage: profileData.statusMessage || '',
          });
        } catch (profileError) {
          console.error('Failed to get profile:', profileError);
        }
      } else {
        if (!liff.isInClient()) {
          console.log('自動ログインを実行します');
          login();
        }
      }
    } catch (initError) {
      console.error('LIFF initialization failed:', initError);
      setError(initError instanceof Error ? initError : new Error('Failed to initialize LIFF'));
    } finally {
      setIsLoading(false);
    }
  };

  // -----------------------------
  // ログイン処理
  // -----------------------------
  const login = () => {
    if (!liffObject) return console.error('LIFF not initialized');
    // liffが初期化済みの場合は直接ログイン
    liff.login({
      redirectUri: window.location.href,
    });
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
    await liff.ready;
    const lineAccessToken = liff.getAccessToken();
    if (!lineAccessToken) {
      throw new Error('LINE access token not available');
    }
    const profile = await getLineProfileServer(lineAccessToken);
    return profile;
  };

  // -----------------------------
  // アクセストークン取得
  // -----------------------------
  const getAccessToken = async (): Promise<string> => {
    await liff.ready;
    const lineAccessToken = liff.getAccessToken();
    if (!lineAccessToken) {
      throw new Error('LINE access token not available');
    }
    return lineAccessToken;
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
