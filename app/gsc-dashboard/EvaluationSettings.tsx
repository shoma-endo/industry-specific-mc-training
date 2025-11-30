'use client';

import { useState, useEffect } from 'react';
import { Loader2, Info, Calendar as CalendarIcon, Settings, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface EvaluationSettingsProps {
  currentEvaluation: {
    base_evaluation_date: string;
    last_evaluated_on: string | null;
    cycle_days: number;
  } | null;
  onRegister: (date: string, cycleDays: number) => Promise<void>;
  onUpdate: (date: string, cycleDays: number) => Promise<void>;
}

// 日付フォーマット用のユーティリティ
const formatDateJP = (dateStr: string | undefined | null) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(d);
};

// 30日後を計算するユーティリティ（UTCベースで計算してズレを防ぐ）
const addDays = (dateStr: string | null | undefined, days: number) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return ''; // 無効な日付の場合は空文字列を返す
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0]!;
};

export function EvaluationSettings({
  currentEvaluation,
  onRegister,
  onUpdate,
}: EvaluationSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  // date string format: YYYY-MM-DD
  const [dateStr, setDateStr] = useState<string>('');
  const [cycleDays, setCycleDays] = useState<number>(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isUpdateMode = !!currentEvaluation;

  // ダイアログが開いたときに初期値をセット
  useEffect(() => {
    if (isOpen) {
      if (currentEvaluation && currentEvaluation.base_evaluation_date) {
        // 型推論の曖昧さを排除するためにテンプレートリテラルで文字列化
        setDateStr(`${currentEvaluation.base_evaluation_date}`);
        setCycleDays(currentEvaluation.cycle_days);
      } else {
        // 今日をデフォルトに
        const today = new Date().toISOString().split('T')[0]!;
        setDateStr(today);
        setCycleDays(30);
      }
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, currentEvaluation]);

  const handleSubmit = async () => {
    if (!dateStr) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isUpdateMode) {
        await onUpdate(dateStr, cycleDays);
        setSuccess('評価基準日を更新しました');
      } else {
        await onRegister(dateStr, cycleDays);
        setSuccess('評価を開始しました');
      }
      // 成功メッセージを見せるために少し待ってから閉じる
      setTimeout(() => setIsOpen(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const nextEvaluationDateStr = dateStr ? addDays(dateStr, cycleDays) : '';

  return (
    <div className="space-y-4 border-t pt-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            評価サイクル設定
            {currentEvaluation && (
              <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                稼働中
              </span>
            )}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {currentEvaluation
              ? `${currentEvaluation.cycle_days}日ごとに検索順位の変動を自動的に追跡・評価します`
              : '設定した日数ごとに検索順位の変動を自動的に追跡・評価します'}
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="default">
              <Settings className="w-4 h-4" />
              {isUpdateMode ? '設定を変更' : '評価を開始'}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{isUpdateMode ? '評価基準日の変更' : '評価サイクルの開始'}</DialogTitle>
              <DialogDescription>
                基準日を設定すると、その日から設定した日数後に初回の順位評価が行われます。
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 space-y-6">
              <div className="space-y-2">
                <label
                  htmlFor="evaluation-date"
                  className="text-sm font-medium text-gray-700 block"
                >
                  評価基準日
                </label>
                <div className="relative">
                  <Input
                    id="evaluation-date"
                    type="date"
                    value={dateStr}
                    onChange={e => setDateStr(e.target.value)}
                    className="pl-10 text-base" // スマホでの操作性を考慮してtext-baseにするのも一案
                  />
                  <CalendarIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
                </div>
                <p className="text-xs text-muted-foreground">
                  カレンダーアイコンをタップするか、直接入力してください
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="cycle-days" className="text-sm font-medium text-gray-700 block">
                  評価サイクル日数
                </label>
                <Input
                  id="cycle-days"
                  type="number"
                  min={1}
                  max={365}
                  value={cycleDays}
                  onChange={e => setCycleDays(Math.max(1, Math.min(365, Number(e.target.value))))}
                  className="max-w-[250px] text-base"
                />
                <p className="text-xs text-muted-foreground">
                  1〜365日の範囲で指定できます（デフォルト: 30日）
                </p>
              </div>

              {dateStr && (
                <div className="rounded-lg bg-blue-50 p-4 border border-blue-100 space-y-3">
                  <div className="flex items-start gap-2">
                    <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-blue-900">評価スケジュールのプレビュー</p>
                      <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-blue-600 text-xs mb-1">基準日</p>
                          <p className="font-semibold text-blue-900">{formatDateJP(dateStr)}</p>
                        </div>
                        <div>
                          <p className="text-blue-600 text-xs mb-1">初回評価日</p>
                          <p className="font-semibold text-blue-900">
                            {formatDateJP(nextEvaluationDateStr)} 12:00 (日本時間)
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertTitle>エラー</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-green-200 bg-green-50 text-green-800">
                  <AlertTitle className="text-green-800">完了</AlertTitle>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={loading}>
                キャンセル
              </Button>
              <Button onClick={handleSubmit} disabled={loading || !dateStr || !!success}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isUpdateMode ? '更新して保存' : 'この日程で開始'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 現在の状態表示カード */}
      {currentEvaluation ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 shadow-sm p-4">
            <div className="text-sm text-blue-600 mb-1">現在の評価基準日</div>
            <div className="text-2xl font-bold text-blue-900">
              {formatDateJP(currentEvaluation.base_evaluation_date)}
            </div>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 shadow-sm p-4">
            <div className="text-sm text-green-600 mb-1">次回評価予定</div>
            <div className="text-2xl font-bold text-green-900">
              {(() => {
                const refDate =
                  currentEvaluation.last_evaluated_on || currentEvaluation.base_evaluation_date;
                const cycleDays = currentEvaluation.cycle_days || 30;
                const nextDate = addDays(refDate, cycleDays);
                return `${formatDateJP(nextDate)} 12:00 (日本時間)`;
              })()}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed p-8 text-center bg-gray-50/50 mt-4">
          <p className="text-muted-foreground font-medium mb-1">未設定</p>
          <p className="text-sm text-gray-500">
            まだ評価サイクルが設定されていません。「評価を開始」ボタンから設定してください。
          </p>
        </div>
      )}
    </div>
  );
}
