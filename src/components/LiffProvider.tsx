'use client';

import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { useLiff } from '@/hooks/useLiff';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { verifyLineTokenServer } from '@/server/handler/actions/login.actions';
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
  const { isLoggedIn, isLoading, error, profile, login, logout, liffObject, initLiff } = useLiff();

  // 🔁 LIFFの初期化を副作用で一度だけ実行
  useEffect(() => {
    if (initialize && !isLoading && !isLoggedIn && !error) {
      initLiff().catch(e => console.error('initLiff error:', e));
    }
  }, [initialize, isLoading, isLoggedIn, error, initLiff]);

  const [syncedWithServer, setSyncedWithServer] = useState(false);

  // コンテキストに値を設定して子コンポーネントにLIFF状態を提供
  const getAccessToken = useCallback(async (): Promise<string> => {
    if (liffObject && isLoggedIn) {
      const token = await liffObject.getAccessToken();
      if (token) return token;
    }
    throw new Error('LIFF is not initialized or user is not logged in');
  }, [liffObject, isLoggedIn]);

  // 🧠 サーバーとの同期処理をuseEffectで適切に管理
  useEffect(() => {
    const syncUserIdWithServer = async () => {
      if (initialize && isLoggedIn && profile && !syncedWithServer) {
        try {
          console.log('LiffProvider: サーバーとの同期を開始');
          // 🔁 サーバーとの同期処理があればここに記述
          const token = await getAccessToken(); // LIFFからアクセストークン取得
          await verifyLineTokenServer(token);   // サーバーに送ってHttpOnly Cookie保存！！
          setSyncedWithServer(true);
          console.log('LiffProvider: サーバーとの同期が完了');
        } catch (error) {
          console.error('Failed to sync user ID with server:', error);
        }
      }
    };

    syncUserIdWithServer();
  }, [initialize, isLoggedIn, profile, syncedWithServer, getAccessToken]);

  // 自動ログイン：LIFF初期化後にログインしていなければ遷移
  useEffect(() => {
    if (!isLoading && liffObject && !isLoggedIn) {
      console.log('LiffProvider: 未ログイン検出、自動ログイン実行');
      login();
    }
  }, [isLoading, liffObject, isLoggedIn, login]);

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
