'use client';

import { useState, useEffect } from 'react';
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
}

export const useLiff = (): UseLiffResult => {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [liffObject, setLiffObject] = useState<typeof liff | null>(null);

  // ログイン処理
  const login = () => {
    if (!liff) return;
    liff.login({
      redirectUri: window.location.href,
    });
  };

  // ログアウト処理
  const logout = () => {
    if (!liff) return;
    liff.logout();
    setIsLoggedIn(false);
    setProfile(null);
    window.location.reload();
  };

  const getLineProfile = async (): Promise<getLineProfileServerResponse> => {
    await liff.ready;
    const lineAccessToken = liff.getAccessToken();
    if (!lineAccessToken) {
      throw new Error('LINE access token not available');
    }
    const profile = await getLineProfileServer(lineAccessToken);
    console.log('profile.front', profile);
    return profile;
  };

  const getAccessToken = async (): Promise<string> => {
    await liff.ready;
    const lineAccessToken = liff.getAccessToken();
    if (!lineAccessToken) {
      throw new Error('LINE access token not available');
    }
    return lineAccessToken;
  };

  // LIFF初期化
  useEffect(() => {
    const initLiff = async () => {
      try {
        const liffId = env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId) {
          throw new Error('LIFF ID is not defined');
        }

        // LIFF初期化
        await liff.init({ liffId });
        setLiffObject(liff);

        // ログイン状態を確認
        if (liff.isLoggedIn()) {
          setIsLoggedIn(true);

          // プロフィール情報を取得
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
          // ログインしていない場合は即座にログイン処理を実行
          // ブラウザ環境でのみ自動ログインを実行（LINE内で実行されている場合は不要）
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

    initLiff();
  }, []);

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
  };
};
