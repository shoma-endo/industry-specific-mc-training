'use client';

import { useState, createContext, useContext, ReactNode } from 'react';
import { useLiff } from '@/hooks/useLiff';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LiffContextType {
  isLoggedIn: boolean;
  isLoading: boolean;
  profile: {
    userId: string;
    displayName: string;
    pictureUrl?: string;
  } | null;
  login: () => void;
  logout: () => void;
  liffObject: unknown;
  getAccessToken: () => Promise<string>;
}

const LiffContext = createContext<LiffContextType | null>(null);

export function useLiffContext() {
  const context = useContext(LiffContext);
  if (!context) {
    throw new Error('useLiffContext must be used within a LiffProvider');
  }
  return context;
}

interface LiffProviderProps {
  children: ReactNode;
  /**
   * LIFF初期化を明示的に呼び出す場所でtrueに設定する
   */
  initialize?: boolean;
}

export function LiffProvider({ children, initialize = false }: LiffProviderProps) {
  const {
    isLoggedIn,
    isLoading,
    error,
    profile,
    login,
    logout,
    liffObject,
    initLiff,
  } = useLiff();

  const [syncedWithServer, setSyncedWithServer] = useState(false);

  // 🔁 LIFFの初期化を明示的に呼び出す（useEffectを使わず、initializeフラグで制御）
  if (initialize && !isLoading && !isLoggedIn && !error) {
    initLiff().catch((e) => console.error('initLiff error:', e));
  }

  // 🧠 サーバーとの同期処理を外から呼べるように分離（useEffect削除）
  const syncUserIdWithServer = async () => {
    if (isLoggedIn && profile && !syncedWithServer) {
      try {
        // 🔁 サーバーとの同期処理があればここに記述
        setSyncedWithServer(true);
      } catch (error) {
        console.error('Failed to sync user ID with server:', error);
      }
    }
  };

  if (initialize && isLoggedIn && profile && !syncedWithServer) {
    syncUserIdWithServer().catch(console.error);
  }
  

  // エラー表示
  if (error) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader>
          <CardTitle className="text-red-500">LIFFエラー</CardTitle>
        </CardHeader>
        <CardContent>
          <p>LIFF初期化中にエラーが発生しました。</p>
          <p className="text-sm text-gray-500">{error.message}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            再読み込み
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ローディング表示
  if (isLoading) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="flex justify-center items-center p-8">
          <p>LIFFを初期化中...</p>
        </CardContent>
      </Card>
    );
  }

  // 非ログイン状態でブラウザ環境の場合はログインボタンを表示
  if (!isLoggedIn && liffObject && !liffObject.isInClient()) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader>
          <CardTitle>LINEログイン</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <p>LINEログイン画面へ移動しています...</p>
          <Button onClick={login}>ログインできない場合はこちら</Button>
        </CardContent>
      </Card>
    );
  }

  // コンテキストに値を設定して子コンポーネントにLIFF状態を提供
  const getAccessToken = async (): Promise<string> => {
    if (liffObject && isLoggedIn) {
      const token = await liffObject.getAccessToken();
      if (token) return token;
    }
    throw new Error('LIFF is not initialized or user is not logged in');
  };

  return (
    <LiffContext.Provider
      value={{
        isLoggedIn,
        isLoading,
        profile,
        login,
        logout,
        liffObject,
        getAccessToken,
      }}
    >
      {children}
    </LiffContext.Provider>
  );
}
