"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertTriangle, Download } from 'lucide-react';

type ImportResponse = {
  success: boolean;
  data?: {
    totalFetched: number;
    upserted: number;
    skipped: number;
    unmatched: number;
    evaluated: number;
  };
  error?: string;
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};

export default function GscImportPage() {
  const [startDate, setStartDate] = useState(daysAgoISO(30));
  const [endDate, setEndDate] = useState(todayISO());
  const [searchType, setSearchType] = useState<'web' | 'image' | 'news'>('web');
  const [maxRows, setMaxRows] = useState(1000);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);

  // 期間（日数）を計算
  const calculateDaysDiff = (start: string, end: string): number => {
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    return Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24));
  };

  const daysDiff = calculateDaysDiff(startDate, endDate);
  const showWarning = daysDiff > 90 || maxRows > 2000;

  const handleSubmit = async () => {
    setIsLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/gsc/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, searchType, maxRows, runEvaluation: false }),
      });

      const json = (await res.json()) as ImportResponse;
      setResult(json);
    } catch (error) {
      setResult({ success: false, error: error instanceof Error ? error.message : 'インポートに失敗しました' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full px-4 py-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Google Search Console 日次指標インポート</h1>

      <Card>
        <CardHeader>
          <CardTitle>期間を指定してインポート</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="startDate" className="text-sm font-medium text-gray-700">
                開始日
              </label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                max={endDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="endDate" className="text-sm font-medium text-gray-700">
                終了日
              </label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                min={startDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <span className="text-sm font-medium text-gray-700">検索タイプ</span>
              <Select value={searchType} onValueChange={v => setSearchType(v as typeof searchType)}>
                <SelectTrigger>
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="web">ウェブ</SelectItem>
                  <SelectItem value="image">画像</SelectItem>
                  <SelectItem value="news">ニュース</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="maxRows" className="text-sm font-medium text-gray-700">
                最大取得件数
              </label>
              <Input
                id="maxRows"
                type="number"
                min={1}
                max={25000}
                value={maxRows}
                onChange={e => setMaxRows(Math.max(1, Math.min(25000, Number(e.target.value) || 0)))}
              />
              <p className="text-xs text-gray-500">
                推奨: 1000～2000 / 上限: 25000
              </p>
            </div>
          </div>

          {showWarning && (
            <Alert variant="default" className="border-amber-200 bg-amber-50">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden />
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">処理に時間がかかる可能性があります</p>
                  <ul className="space-y-1 text-xs">
                    {daysDiff > 90 && <li>• 期間が90日を超えています（{daysDiff}日間）。推奨: 30日以内</li>}
                    {maxRows > 2000 && <li>• 最大取得行数が2000を超えています。推奨: 1000～2000</li>}
                  </ul>
                </div>
              </div>
            </Alert>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={handleSubmit} disabled={isLoading} className="min-w-[180px]">
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  インポート中...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  インポートを実行
                </span>
              )}
            </Button>
            <p className="text-sm text-gray-600">評価は行わず、指標のみをシステムに保存します。</p>
          </div>

          {result && (
            <Alert variant={result.success ? 'default' : 'destructive'}>
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" aria-hidden />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-600" aria-hidden />
                )}
                <div>
                  <p className="font-medium">
                    {result.success ? 'インポート完了' : 'インポートに失敗しました'}
                  </p>
                  <AlertDescription className="space-y-1 mt-2 text-sm">
                    {result.success && result.data ? (
                      <>
                        <div>取得件数: {result.data.totalFetched}</div>
                        <div>登録/更新: {result.data.upserted}</div>
                        <div>スキップ: {result.data.skipped}</div>
                        <div>注釈未マッチ: {result.data.unmatched}</div>
                      </>
                    ) : (
                      <div>{result.error ?? '不明なエラーが発生しました'}</div>
                    )}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
