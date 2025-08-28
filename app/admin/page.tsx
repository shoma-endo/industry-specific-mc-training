import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">管理者ダッシュボード</h1>
        <p className="mt-2 text-gray-600">AI Marketing Assistantの管理機能にアクセスできます</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-shadow flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span className="text-blue-600">🎯</span>
              <span>プロンプト管理</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <p className="text-gray-600 mb-4 flex-1">
              AIが使用するプロンプトテンプレートを作成・編集・管理します
            </p>
            <Link href="/admin/prompts">
              <Button className="w-full">プロンプト管理画面へ</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span className="text-green-600">👥</span>
              <span>ユーザー管理</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <p className="text-gray-600 mb-4 flex-1">
              登録ユーザーの管理とサブスクリプション状況を確認します
            </p>
            <Link href="/admin/users">
              <Button className="w-full">ユーザー管理画面へ</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
