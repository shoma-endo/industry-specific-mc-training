'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useLiff } from '@/hooks/useLiff';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Footer } from '@/components/Footer';
import type { LiffContextType } from '@/types/components';
import type { User } from '@/types/user';
import { usePathname, useRouter } from 'next/navigation';
import { isOwner } from '@/authUtils';

const LiffContext = createContext<LiffContextType | null>(null);

export function useLiffContext() {
  const context = useContext(LiffContext);
  if (!context) {
    throw new Error('useLiffContext must be used within a LiffProvider');
  }
  return context;
}

import type { LiffProviderProps } from '@/types/components';

export function LiffProvider({ children, initialize = false }: LiffProviderProps) {
  const { isLoggedIn, isLoading, error, profile, login, logout, liffObject, initLiff } = useLiff();
  const pathname = usePathname();
  const router = useRouter();

  // 🔁 LIFFの初期化を副作用で一度だけ実行
  useEffect(() => {
    if (initialize && !isLoading && !isLoggedIn && !error) {
      initLiff().catch(e => console.error('initLiff error:', e));
    }
  }, [initialize, isLoading, isLoggedIn, error, initLiff]);

  const [syncedWithServer, setSyncedWithServer] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [hasServerSession, setHasServerSession] = useState<boolean | null>(null);
  const hasRequestedLiffLoginRef = useRef(false);

  // ✅ 最新の値を参照するためのRef
  const liffObjectRef = useRef(liffObject);
  const isLoggedInRef = useRef(isLoggedIn);

  // Refを最新の値で更新
  useEffect(() => {
    liffObjectRef.current = liffObject;
  }, [liffObject]);

  useEffect(() => {
    isLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn]);

  // ✅ 完全に安定したgetAccessToken（依存配列なし）
  const getAccessToken = useCallback(async (): Promise<string> => {
    const currentLiff = liffObjectRef.current;
    const currentLoggedIn = isLoggedInRef.current;

    if (!currentLiff) {
      throw new Error('LIFF is not initialized');
    }

    if (!currentLoggedIn) {
      throw new Error('User is not logged in');
    }

    try {
      const token = await (
        currentLiff as unknown as { getAccessToken: () => Promise<string> }
      ).getAccessToken();
      if (token) return token;
      throw new Error('Failed to get access token from LIFF');
    } catch (error) {
      console.error('getAccessToken error:', error);
      throw new Error('LIFF is not initialized or user is not logged in');
    }
  }, []); // ✅ 依存配列完全に空

  // ✅ サーバー同期をuseEffectから分離してイベントドリブンに変更
  const syncWithServerIfNeeded = useCallback(async () => {
    if (initialize && isLoggedIn && profile && !syncedWithServer) {
      try {
        const token = await getAccessToken();
        // サーバーAPIから現在のユーザー情報を取得（Authorizationヘッダーでアクセストークンを送信）
        const res = await fetch('/api/user/current', {
          method: 'GET',
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.user) {
            setUser(data.user as User);
          } else if (data && data.userId) {
            // 最低限の情報のみ
            setUser({ id: data.userId } as User);
          }
        }

        setSyncedWithServer(true);
      } catch (error) {
        console.error('Failed to sync user ID with server:', error);
      }
    }
  }, [initialize, isLoggedIn, profile, syncedWithServer, getAccessToken]);

  const refreshUser = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/user/current', {
        method: 'GET',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.user) {
          setUser(data.user as User);
        } else if (data && data.userId) {
          setUser({ id: data.userId } as User);
        }
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, [getAccessToken]);

  // ✅ 初期化完了時にのみサーバー同期を実行
  useEffect(() => {
    if (isLoggedIn && profile && !isInitialized) {
      syncWithServerIfNeeded();
      setIsInitialized(true);
    }
  }, [isLoggedIn, profile, isInitialized, syncWithServerIfNeeded]);

  // 公開パスの定義 - ルートを除外
  const publicPaths = ['/home', '/privacy', '/login', '/invite'];
  // pathnameが取得できない場合（稀なケース）はfalseとして扱うが、SSR時はpathnameがあるため正しく判定される
  const isPublicPath = pathname
    ? publicPaths.some(
        path => pathname === path || (path !== '/' && pathname.startsWith(path + '/'))
      )
    : false;

  useEffect(() => {
    if (!pathname || isPublicPath) {
      setHasServerSession(null);
      return;
    }

    let cancelled = false;

    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/check-role', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!cancelled) {
          setHasServerSession(response.ok);
        }
      } catch (sessionError) {
        console.error('Failed to check server session:', sessionError);
        if (!cancelled) {
          setHasServerSession(false);
        }
      }
    };

    checkSession();

    return () => {
      cancelled = true;
    };
  }, [isPublicPath, pathname]);

  useEffect(() => {
    if (!pathname || isPublicPath || hasServerSession !== false) {
      return;
    }

    const clientChecker = liffObject as unknown as { isInClient?: () => boolean } | null;
    const isInClient = clientChecker?.isInClient?.() ?? false;

    if (isInClient) {
      if (!isLoading && liffObject && !isLoggedIn) {
        login();
      }
      return;
    }

    router.replace('/login');
  }, [
    hasServerSession,
    isLoading,
    isLoggedIn,
    isPublicPath,
    liffObject,
    login,
    pathname,
    router,
  ]);

  useEffect(() => {
    if (!pathname) {
      return;
    }
    if (isOwner(user?.role ?? null) && pathname !== '/') {
      router.replace('/');
    }
  }, [pathname, router, user?.role]);

  useEffect(() => {
    if (
      !pathname ||
      isPublicPath ||
      hasServerSession !== true ||
      isLoggedIn ||
      isLoading ||
      !liffObject ||
      hasRequestedLiffLoginRef.current
    ) {
      return;
    }

    hasRequestedLiffLoginRef.current = true;
    login();
  }, [hasServerSession, isLoading, isLoggedIn, isPublicPath, liffObject, login, pathname]);

  // エラー表示（公開パス以外）
  if (error && !isPublicPath) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader>
          <CardTitle className="text-red-500">LIFFエラー</CardTitle>
        </CardHeader>
        <CardContent>
          <p>LIFF初期化中にエラーが発生しました。</p>
          <p className="text-sm text-gray-500">{error}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            再読み込み
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ローディング表示（公開パスの場合はローディング中もchildrenを表示させる）
  // 非公開パスでローディング中は、コンテンツを隠してローディング表示
  if (isLoading && !isPublicPath) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="flex justify-center items-center p-8">
          <p>LIFFを初期化中...</p>
        </CardContent>
      </Card>
    );
  }

  // 🚨 修正: 未ログイン時の強制ログイン画面表示を削除
  // Middlewareがログイン状態を保証しているため、ここではチェックしない
  // これにより、サーバーサイドログイン済みだがLIFF SDK未ログインの場合もページを表示できる
  /*
  if (
    pathname &&
    !isLoggedIn &&
    liffObject &&
    !(liffObject as unknown as { isInClient: () => boolean }).isInClient() &&
    !isPublicPath
  ) {
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
  */

  return (
    <LiffContext.Provider
      value={{
        isLoggedIn,
        isLoading,
        profile,
        user,
        login,
        logout,
        liffObject,
        getAccessToken,
        refreshUser,
      }}
    >
      <div className="flex flex-col min-h-screen">
        {/* 公開ページの場合はpb-20 (フッター分の余白) を適用しない */}
        <main className={`flex-1 ${isPublicPath ? '' : 'pb-20'}`}>{children}</main>
        {/* 公開ページ以外でのみFooterを表示 */}
        {!isPublicPath && !isOwner(user?.role ?? null) && <Footer />}
      </div>
    </LiffContext.Provider>
  );
}
