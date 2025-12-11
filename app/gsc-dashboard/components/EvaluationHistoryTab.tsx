'use client';

import { useState, useTransition } from 'react';
import { ChevronRight, Loader2, CheckCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { GSC_EVALUATION_OUTCOME_CONFIG } from '@/types/gsc';
import { markSuggestionAsRead } from '@/server/actions/gscNotification.actions';
import type { GscEvaluationHistoryItem } from '../types';

interface EvaluationHistoryTabProps {
  history: GscEvaluationHistoryItem[] | undefined;
}

/**
 * ISO8601形式の日時文字列を「2025年12月11日 12:34」形式にフォーマット
 */
function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  });
  return formatter.format(date);
}

export function EvaluationHistoryTab({ history: initialHistory }: EvaluationHistoryTabProps) {
  const [history, setHistory] = useState(initialHistory);
  const [selectedHistory, setSelectedHistory] = useState<GscEvaluationHistoryItem | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleMarkAsRead = (historyId: string) => {
    startTransition(async () => {
      const result = await markSuggestionAsRead(historyId);
      if (result.success) {
        // ローカル状態を更新
        setHistory(prev =>
          prev?.map(item => (item.id === historyId ? { ...item, is_read: true } : item))
        );
        // ダイアログ内の選択中アイテムも更新
        if (selectedHistory?.id === historyId) {
          setSelectedHistory(prev => (prev ? { ...prev, is_read: true } : null));
        }
        toast.success('既読にしました');
      } else {
        toast.error(result.error || '既読処理に失敗しました');
      }
    });
  };

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardContent className="py-20 text-center text-gray-500">
          <p>まだ評価履歴がありません</p>
          <p className="text-sm mt-2">概要タブから評価サイクルを開始してください</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {history.map(item => {
              const showUnreadBadge = !item.is_read && item.outcome !== 'improved';
              return (
                <div
                  key={item.id}
                  className="group p-4 rounded-lg border bg-white flex items-center justify-between shadow-sm cursor-pointer hover:bg-gray-50 hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
                  onClick={() => setSelectedHistory(item)}
                >
                  <div className="flex items-center gap-3">
                    {showUnreadBadge && (
                      <span className="flex h-2 w-2 rounded-full bg-amber-500" title="未読" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{formatDateTime(item.created_at)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">判定:</span>
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ring-gray-500/10 ${GSC_EVALUATION_OUTCOME_CONFIG[item.outcome].className}`}
                        >
                          {GSC_EVALUATION_OUTCOME_CONFIG[item.outcome].label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="flex items-baseline gap-2 justify-end">
                        <span className="text-xs text-gray-500">
                          前回: {item.previous_position ?? '—'}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="text-lg font-bold text-gray-900">
                          {item.current_position}
                        </span>
                        <span className="text-xs text-gray-500">位</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-200" />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 評価履歴詳細Dialog */}
      <Dialog
        open={selectedHistory !== null}
        onOpenChange={open => !open && setSelectedHistory(null)}
      >
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AIの改善提案内容</DialogTitle>
          </DialogHeader>
          {selectedHistory && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500 mb-1">評価日</p>
                  <p className="text-sm font-medium">{formatDateTime(selectedHistory.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">判定</p>
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ring-gray-500/10 ${GSC_EVALUATION_OUTCOME_CONFIG[selectedHistory.outcome].className}`}
                  >
                    {GSC_EVALUATION_OUTCOME_CONFIG[selectedHistory.outcome].label}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">前回順位</p>
                  <p className="text-sm font-medium">{selectedHistory.previous_position ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">現在順位</p>
                  <p className="text-sm font-medium">{selectedHistory.current_position}位</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">改善提案</p>
                {selectedHistory.suggestion_summary ? (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-headings:font-bold prose-h1:text-xl prose-h1:border-b prose-h1:border-slate-300 prose-h1:pb-2 prose-h1:mb-4 prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3 prose-p:text-slate-700 prose-p:leading-relaxed prose-ul:my-2 prose-li:my-1 prose-hr:my-6 prose-hr:border-slate-300">
                      <ReactMarkdown>{selectedHistory.suggestion_summary}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">提案なし</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            {selectedHistory &&
              !selectedHistory.is_read &&
              selectedHistory.outcome !== 'improved' && (
                <Button
                  onClick={() => handleMarkAsRead(selectedHistory.id)}
                  disabled={isPending}
                  className="gap-2"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCheck className="h-4 w-4" />
                  )}
                  既読にする
                </Button>
              )}
            {selectedHistory?.is_read && (
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <CheckCheck className="h-4 w-4" />
                既読済み
              </span>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
