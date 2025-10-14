'use client';

import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const hasAttemptedAutoLogin = useRef(false);

  const loginWithLine = async () => {
    setIsLoading(true);
    try {
      // サーバー側でセキュアなstate生成とCookie設定
      const response = await fetch('/api/auth/line-oauth-init');
      if (!response.ok) {
        throw new Error('OAuth初期化に失敗しました');
      }

      const { authUrl } = await response.json();
      // LINE OAuth認証ページへリダイレクト
      window.location.href = authUrl;
    } catch (error) {
      console.error('Login Error:', error);
      alert('ログインに失敗しました。もう一度お試しください。');
      setShowButton(true);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (hasAttemptedAutoLogin.current) {
      return;
    }
    hasAttemptedAutoLogin.current = true;

    const autoLogin = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/auth/check-role', {
          credentials: 'include',
        });

        if (response.ok) {
          router.replace('/');
          return;
        }

        if (response.status === 401) {
          await loginWithLine();
          return;
        }

        setShowButton(true);
        setIsLoading(false);
      } catch (error) {
        console.error('Auto login check failed:', error);
        setShowButton(true);
        setIsLoading(false);
      }
    };

    autoLogin();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Button
        onClick={loginWithLine}
        disabled={!showButton || isLoading}
        size="lg"
        className="bg-[#06C755] text-white hover:bg-[#06C755] hover:opacity-90 active:opacity-70 px-4 py-2 rounded-md disabled:opacity-50"
      >
        {isLoading ? '処理中...' : 'LINEでログイン'}
      </Button>
    </div>
  );
}
