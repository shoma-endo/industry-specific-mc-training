'use client';

import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);

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
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Button
        onClick={loginWithLine}
        disabled={isLoading}
        size="lg"
        className="bg-[#06C755] text-white hover:bg-[#06C755] hover:opacity-90 active:opacity-70 px-4 py-2 rounded-md disabled:opacity-50"
      >
        {isLoading ? '処理中...' : 'LINEでログイン'}
      </Button>
    </div>
  );
}
