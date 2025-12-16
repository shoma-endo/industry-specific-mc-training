'use client';

import { useEffect, useState, useTransition } from 'react';
import { ChevronRight, Loader2, CheckCheck, MessageSquare, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { MODEL_CONFIGS } from '@/lib/constants';

// 改善提案セクションの共通スタイル
const SUGGESTION_STYLE = {
  badgeClass: 'bg-blue-100 text-blue-800',
  sectionClass: 'bg-white border-gray-200',
};

interface EvaluationHistoryTabProps {
  history: GscEvaluationHistoryItem[] | undefined;
  onHistoryRead?: (historyId: string) => void;
}

export function EvaluationHistoryTab({ history: initialHistory, onHistoryRead }: EvaluationHistoryTabProps) {
  const [history, setHistory] = useState(initialHistory);
  const [selectedHistory, setSelectedHistory] = useState<GscEvaluationHistoryItem | null>(null);
  const [isPending, startTransition] = useTransition();

  // 親からの最新履歴に同期（ローカルで既読にした状態を保持）
  useEffect(() => {
    if (!initialHistory) {
      setHistory(initialHistory);
      return;
    }

    // ローカルで既読にしたアイテムの is_read 状態を保持
    setHistory(prev => {
      if (!prev) return initialHistory;

      return initialHistory.map(item => {
        const localItem = prev.find(p => p.id === item.id);
        // ローカルで既読にしている場合は、その状態を保持
        if (localItem && localItem.is_read && !item.is_read) {
          return { ...item, is_read: true };
        }
        return item;
      });
    });

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
              const isError = item.outcomeType === 'error';
              const showUnreadBadge = !isError && !item.is_read && item.outcome !== null && item.outcome !== 'improved';

              return (
                <div
                  key={item.id}
                  className={`group p-4 rounded-lg border flex items-center justify-between shadow-sm cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200 ${
                    isError
                      ? 'bg-red-50 border-red-200 hover:bg-red-100'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedHistory(item)}
                >
                  <div className="flex items-center gap-3">
                    {isError && (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    {showUnreadBadge && (
                      <span className="flex h-2 w-2 rounded-full bg-amber-500" title="未読" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{formatDateTime(item.created_at)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          {isError ? 'エラー:' : '判定:'}
                        </span>
                        {isError ? (
                          <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset bg-red-50 text-red-700 ring-red-600/20">
                            評価失敗
                          </span>
                        ) : item.outcome && GSC_EVALUATION_OUTCOME_CONFIG[item.outcome] ? (
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ring-gray-500/10 ${GSC_EVALUATION_OUTCOME_CONFIG[item.outcome].className}`}
                          >
                            {GSC_EVALUATION_OUTCOME_CONFIG[item.outcome].label}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset bg-gray-50 text-gray-700 ring-gray-500/10">
                            データなし
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!isError && (
                      <div className="text-right">
                        <div className="flex items-baseline gap-2 justify-end">
                          <span className="text-xs text-gray-500">
                            前回: {item.previous_position ?? '—'}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="text-lg font-bold text-gray-900">
                            {item.current_position ?? '—'}
                          </span>
                          {item.current_position !== null && (
                            <span className="text-xs text-gray-500">位</span>
                          )}
                        </div>
                      </div>
                    )}
                    <ChevronRight className={`w-5 h-5 transition-all duration-200 ${
                      isError
                        ? 'text-red-400 group-hover:text-red-600'
                        : 'text-gray-400 group-hover:text-blue-600'
                    } group-hover:translate-x-1`} />
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
              {selectedHistory.outcomeType === 'error' ? (
                // エラー時の表示
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>評価実行エラー</AlertTitle>
                  <AlertDescription>
                    <div className="space-y-2 mt-2">
                      <p className="text-sm">
                        <span className="font-medium">エラー種別: </span>
                        {selectedHistory.errorCode === 'import_failed'
                          ? 'GSCデータ取得失敗'
                          : 'メトリクスデータなし'}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">詳細: </span>
                        {selectedHistory.errorMessage}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">発生日時: </span>
                        {formatDateTime(selectedHistory.created_at)}
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : (
                // 成功時の表示（既存）
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">評価日</p>
                    <p className="text-sm font-medium">{formatDateTime(selectedHistory.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">判定</p>
                    {selectedHistory.outcome && GSC_EVALUATION_OUTCOME_CONFIG[selectedHistory.outcome] ? (
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ring-gray-500/10 ${GSC_EVALUATION_OUTCOME_CONFIG[selectedHistory.outcome].className}`}
                      >
                        {GSC_EVALUATION_OUTCOME_CONFIG[selectedHistory.outcome].label}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset bg-gray-50 text-gray-700 ring-gray-500/10">
                        データなし
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">前回順位</p>
                    <p className="text-sm font-medium">{selectedHistory.previous_position ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">現在順位</p>
                    <p className="text-sm font-medium">
                      {selectedHistory.current_position ?? '—'}
                      {selectedHistory.current_position !== null && '位'}
                    </p>
                  </div>
                </div>
              )}
              {selectedHistory.outcomeType !== 'error' && (
                <div>
                  <p className="text-sm font-semibold mb-2">改善提案</p>
                  {selectedHistory.suggestion_summary ? (
                  <div className="space-y-4">
                    {(() => {
                      // セクション分割
                      const sections = selectedHistory.suggestion_summary.split('\n\n---\n\n');

                      // 各セクションを処理
                      const processedSections = sections
                        .map(section => {
                          // 見出しを抽出
                          const headingMatch = section.match(/^#\s+(.+)$/m);
                          const heading = headingMatch ? headingMatch[1].trim() : null;

                          // 見出しから templateName を特定
                          let templateName: string | null = null;
                          if (heading) {
                            for (const [name, config] of Object.entries(MODEL_CONFIGS)) {
                              if (config.label === heading) {
                                templateName = name;
                                break;
                              }
                            }
                          }

                          // 見出しを除いたコンテンツ
                          const content = heading
                            ? section.replace(/^#\s+.+$/m, '').trim()
                            : section.trim();

                          return { templateName, heading, content };
                        })
                        .filter(s => s.templateName !== null && s.content.length > 0);

                      // 順序を保証（CTR改善 → 導入文 → 本文 → ペルソナ再構築）
                      const order = [
                        'gsc_insight_ctr_boost',
                        'gsc_insight_intro_refresh',
                        'gsc_insight_body_rewrite',
                        'gsc_insight_persona_rebuild',
                      ];
                      processedSections.sort((a, b) => {
                        const aIndex = order.indexOf(a.templateName!);
                        const bIndex = order.indexOf(b.templateName!);
                        return aIndex - bIndex;
                      });

                      // レンダリング
                      return processedSections.map((section, index) => {
                        const config = MODEL_CONFIGS[section.templateName!];
                        if (!config) return null;

                        return (
                          <div
                            key={index}
                            className={`p-4 rounded-lg border ${SUGGESTION_STYLE.sectionClass}`}
                          >
                            <div className="mb-3 flex items-center gap-2">
                              <MessageSquare className="w-5 h-5 text-blue-600" />
                              <span
                                className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-semibold ${SUGGESTION_STYLE.badgeClass}`}
                              >
                                {config.label}
                              </span>
                            </div>
                            <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-headings:font-bold prose-h1:text-lg prose-h1:normal-case prose-h2:text-base prose-h2:mt-4 prose-h2:mb-3 prose-p:text-slate-700 prose-p:leading-relaxed prose-ul:my-2 prose-li:my-1">
                              <ReactMarkdown>{section.content}</ReactMarkdown>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">提案なし</p>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedHistory &&
              !selectedHistory.is_read &&
              selectedHistory.outcomeType !== 'error' &&
              selectedHistory.outcome !== null &&
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
