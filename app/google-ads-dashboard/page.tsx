import Link from 'next/link';
import { ArrowLeft, BarChart3, TrendingUp, DollarSign, MousePointer2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function GoogleAdsDashboardPage() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/setup"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            設定に戻る
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            Google Ads パフォーマンス
          </h1>
          <p className="text-gray-500">
            連携済みアカウントの広告パフォーマンス概要（デモ画面）
          </p>
        </div>
        <div className="flex items-center gap-3">
           {/* 将来的に期間指定などを配置 */}
           <Button variant="outline" disabled>期間: 過去30日間</Button>
        </div>
      </div>

      {/* Metrics Cards (Mock) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <MousePointer2 className="h-4 w-4 text-blue-500" />
              <p className="text-sm font-medium text-gray-500">クリック数</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">0</p>
            <p className="text-xs text-gray-400 mt-1">前期間比 --%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <p className="text-sm font-medium text-gray-500">表示回数</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">0</p>
            <p className="text-xs text-gray-400 mt-1">前期間比 --%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-purple-500" />
              <p className="text-sm font-medium text-gray-500">CTR</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">0.00%</p>
            <p className="text-xs text-gray-400 mt-1">前期間比 --%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-orange-500" />
              <p className="text-sm font-medium text-gray-500">費用</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">¥0</p>
            <p className="text-xs text-gray-400 mt-1">前期間比 --%</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns Table (Placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle>キャンペーン一覧</CardTitle>
          <CardDescription>
            取得されたキャンペーンデータがここに表示されます。現在はデータがありません。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>キャンペーン名</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead className="text-right">クリック数</TableHead>
                  <TableHead className="text-right">表示回数</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">費用</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Empty State */}
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                    データがありません。設定ページからGoogle Adsアカウントを連携してください。
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
