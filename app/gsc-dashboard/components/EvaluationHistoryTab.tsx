'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ReactMarkdown from 'react-markdown';
import { GSC_EVALUATION_OUTCOME_CONFIG } from '@/types/gsc';
import type { GscEvaluationHistoryItem } from '../types';

interface EvaluationHistoryTabProps {
  history: GscEvaluationHistoryItem[] | undefined;
}

export function EvaluationHistoryTab({ history }: EvaluationHistoryTabProps) {
  const [selectedHistory, setSelectedHistory] = useState<GscEvaluationHistoryItem | null>(null);

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
            {history.map(item => (
              <div
                key={item.id}
                className="group p-4 rounded-lg border bg-white flex items-center justify-between shadow-sm cursor-pointer hover:bg-gray-50 hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
                onClick={() => setSelectedHistory(item)}
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.evaluation_date}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">判定:</span>
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ring-gray-500/10 ${GSC_EVALUATION_OUTCOME_CONFIG[item.outcome].className}`}
                    >
                      {GSC_EVALUATION_OUTCOME_CONFIG[item.outcome].label}
                    </span>
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
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 評価履歴詳細Dialog */}
      <Dialog
        open={selectedHistory !== null}
        onOpenChange={open => !open && setSelectedHistory(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AIの改善提案内容</DialogTitle>
          </DialogHeader>
          {selectedHistory && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500 mb-1">評価日</p>
                  <p className="text-sm font-medium">{selectedHistory.evaluation_date}</p>
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
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-sm text-gray-800 prose prose-sm max-w-none">
                      <ReactMarkdown>{selectedHistory.suggestion_summary}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">提案なし</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

