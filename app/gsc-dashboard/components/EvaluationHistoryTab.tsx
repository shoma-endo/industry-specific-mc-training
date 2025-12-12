'use client';

import { useEffect, useState, useTransition } from 'react';
import { ChevronRight, Loader2, CheckCheck, MessageSquare } from 'lucide-react';
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
import { formatDateTime } from '@/lib/utils';

// 各セクションのスタイル定義
const SUGGESTION_SECTION_STYLES: Record<
  string,
  { badgeClass: string; sectionClass: string }
> = {
  '広告タイトル・説明文の提案': {
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    sectionClass: 'bg-blue-50 border-blue-200',
  },
  '書き出し案の提案': {
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    sectionClass: 'bg-blue-50 border-blue-200',
  },
  '本文の提案': {
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    sectionClass: 'bg-blue-50 border-blue-200',
  },
};

interface EvaluationHistoryTabProps {
  history: GscEvaluationHistoryItem[] | undefined;
  onHistoryRead?: (historyId: string) => void;
}

export function EvaluationHistoryTab({ history: initialHistory, onHistoryRead }: EvaluationHistoryTabProps) {
  const [history, setHistory] = useState(initialHistory);
  const [selectedHistory, setSelectedHistory] = useState<GscEvaluationHistoryItem | null>(null);
  const [isPending, startTransition] = useTransition();

  // 親からの最新履歴に同期
  useEffect(() => {
    setHistory(initialHistory);
    // 選択中の履歴がなくなった場合に閉じる
    if (selectedHistory && !initialHistory?.some(item => item.id === selectedHistory.id)) {
      setSelectedHistory(null);
    }
  }, [initialHistory, selectedHistory]);

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
        onHistoryRead?.(historyId);
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
                  <div className="space-y-4">
                    {selectedHistory.suggestion_summary.split('\n\n---\n\n').map((section, index) => {
                      // 見出し（# で始まる行）を抽出
                      const headingMatch = section.match(/^#\s+(.+)$/m);
                      const heading = headingMatch ? headingMatch[1].trim() : null;
                      const content = heading
                        ? section.replace(/^#\s+.+$/m, '').trim()
                        : section.trim();

                      // 見出しに対応するスタイルを取得
                      const style = heading ? SUGGESTION_SECTION_STYLES[heading] : null;

                      return (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border ${style?.sectionClass || 'bg-slate-50 border-slate-200'}`}
                        >
                          {heading && style && (
                            <div className="mb-3 flex items-center gap-2">
                              <MessageSquare className="w-5 h-5 text-blue-600" />
                              <span
                                className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-semibold border ${style.badgeClass}`}
                              >
                                {heading}
                              </span>
                            </div>
                          )}
                          <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-headings:font-bold prose-h2:text-lg prose-h2:mt-4 prose-h2:mb-3 prose-p:text-slate-700 prose-p:leading-relaxed prose-ul:my-2 prose-li:my-1">
                            <ReactMarkdown>{content}</ReactMarkdown>
                          </div>
                        </div>
                      );
                    })}
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
