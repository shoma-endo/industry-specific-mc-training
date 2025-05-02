'use client';

import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const loginWithLine = () => {
    const state = crypto.randomUUID(); // ランダムなstateを生成
    // Cookieにstateを保存
    document.cookie = `line_oauth_state=${state}; path=/; max-age=600;`;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.NEXT_PUBLIC_LIFF_CHANNEL_ID!, // env モジュールから取得
      redirect_uri: `${window.location.origin}/api/line/callback`,
      state,
      scope: 'profile openid email', // 必要なスコープを指定
    });

    window.location.href = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`; // toString() を追加
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Button
        onClick={loginWithLine}
        size="lg"
        className="bg-[#06C755] text-white hover:bg-[#06C755] hover:opacity-90 active:opacity-70 px-4 py-2 rounded-md"
      >
        LINEでログイン
      </Button>
    </div>
  );
}
