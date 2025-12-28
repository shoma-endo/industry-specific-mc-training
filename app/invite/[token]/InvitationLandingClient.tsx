'use client';

import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

interface InvitationLandingClientProps {
  ownerName: string;
  token: string;
}

export default function InvitationLandingClient({
  ownerName,
  token,
}: InvitationLandingClientProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    setIsLoading(true);
    try {
      // 招待トークン付きでOAuth初期化エンドポイントを呼び出し
      const response = await fetch(`/api/auth/line-oauth-init?invitation_token=${token}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('OAuth init failed');
      }

      const { authUrl } = await response.json();

      if (authUrl) {
        window.location.href = authUrl;
      } else {
        throw new Error('認証URLの取得に失敗しました');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('エラーが発生しました。もう一度お試しください。');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center space-y-8">
        <div className="space-y-4">
          <div className="w-16 h-16 bg-[#06C755] bg-opacity-10 rounded-full flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-[#06C755]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">スタッフとして参加</h1>
          <p className="text-gray-600">
            <span className="font-semibold text-gray-900">{ownerName}</span>
            さんから
            <br />
            スタッフメンバーとしての招待が届いています。
          </p>
        </div>

        <div className="space-y-4">
          <Button
            onClick={handleRegister}
            disabled={isLoading}
            className="w-full bg-[#06C755] hover:bg-[#05b34c] text-white py-6 text-lg rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" />
                処理中...
              </>
            ) : (
              'LINEでログインして参加'
            )}
          </Button>
          <p className="text-xs text-gray-500">
            ※ すでにアカウントをお持ちの場合も、こちらからログインすることでスタッフとして連携されます。
          </p>
        </div>
      </div>
    </div>
  );
}
