import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">管理者ダッシュボード</h1>
        <p className="mt-2 text-gray-600">
          AI Marketing Assistantの管理機能にアクセスできます
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span className="text-blue-600">🎯</span>
              <span>プロンプト管理</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              AIが使用するプロンプトテンプレートを作成・編集・管理します
            </p>
            <Link href="/admin/prompts">
              <Button className="w-full">
                プロンプト管理画面へ
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span className="text-green-600">👥</span>
              <span>ユーザー管理</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              登録ユーザーの管理とサブスクリプション状況を確認します
            </p>
            <Button variant="outline" className="w-full" disabled>
              準備中
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span className="text-purple-600">📊</span>
              <span>使用状況分析</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              チャット利用状況や機能使用状況を分析します
            </p>
            <Button variant="outline" className="w-full" disabled>
              準備中
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span className="text-orange-600">⚙️</span>
              <span>システム設定</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              アプリケーション全体の設定とコンフィグを管理します
            </p>
            <Button variant="outline" className="w-full" disabled>
              準備中
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span className="text-red-600">🔐</span>
              <span>セキュリティ</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              アクセスログやセキュリティ設定を管理します
            </p>
            <Button variant="outline" className="w-full" disabled>
              準備中
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>最近のアクティビティ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <p>アクティビティログ機能は準備中です</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}