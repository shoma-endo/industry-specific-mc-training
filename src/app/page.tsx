'use client';

import { useLiffContext } from '@/components/LiffProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';

function ProfileDisplay() {
  const { profile, isLoading, isLoggedIn, logout } = useLiffContext();

  if (isLoading) {
    return <p className="text-center my-4">プロフィール読み込み中...</p>;
  }

  if (!isLoggedIn || !profile) {
    return <p className="text-center my-4">LINEアカウントでログインすると情報が表示されます</p>;
  }

  return (
    <Card className="w-full max-w-md mb-6">
      <CardHeader>
        <CardTitle className="text-xl text-center">LINEプロフィール</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        {profile.pictureUrl && (
          <Avatar className="h-24 w-24 mb-4">
            <img src={profile.pictureUrl} alt={profile.displayName} />
          </Avatar>
        )}
        <h3 className="text-xl font-bold mb-2">{profile.displayName}</h3>
        <p className="text-sm text-gray-600 mb-4">ユーザーID: {profile.userId}</p>
        <button
          onClick={logout}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm"
        >
          ログアウト
        </button>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">業界特化MC養成講座</h1>

      <ProfileDisplay />

      <div className="p-8 max-w-md w-full bg-white rounded-lg shadow-md">
        <p className="text-center text-gray-700 mb-4">
          市場選定〜LPドラフト作成までを<br />
          サポートするアプリケーションです。
        </p>
        <p className="text-center text-gray-700">ログインしてサービスをご利用ください。</p>
      </div>
    </div>
  );
}
