'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';
import {
  getUnreadSuggestions,
  markAllSuggestionsAsRead,
  type UnreadSuggestion,
} from '@/server/actions/gscNotification.actions';
import { useFaviconBadge } from '@/hooks/useFaviconBadge';
import { Loader2, CheckCheck } from 'lucide-react';

export function GscNotificationHandler() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [suggestions, setSuggestions] = useState<UnreadSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);

  // Faviconバッジの更新
  useFaviconBadge(unreadCount);

  useEffect(() => {
    let mounted = true;

    const fetchUnread = async () => {
      try {
        const result = await getUnreadSuggestions();
        if (mounted && result.count > 0) {
          setUnreadCount(result.count);
          setSuggestions(result.suggestions);

          // トースト通知（重複防止のためIDを指定しても良いが、今回はシンプルに）
          // 既に表示されているかどうかのチェックは難しいので、データロード時に1回出す
          toast.info('新しい改善提案が届いています', {
            description: `${result.count}件の提案があります。クリックして確認してください。`,
            duration: Infinity, // ユーザーが閉じるまで表示
            action: {
              label: '確認する',
              onClick: () => setIsOpen(true),
            },
            // トースト自体をクリックしても開くようにしたいが、Sonnerはactionボタン推奨
            // 全体クリックイベントはonDismiss等で制御できないため、actionボタンのみ
          });
        }
      } catch (error) {
        console.error('Failed to fetch unread suggestions', error);
      }
    };

    fetchUnread();

    return () => {
      mounted = false;
    };
  }, []); // 初回マウント時のみ実行（ポーリングが必要ならintervalを追加）

  const handleClose = async () => {
    // 閉じるタイミングで既読にする
    if (suggestions.length === 0) {
      setIsOpen(false);
      return;
    }

    if (!confirm('これらの提案を既読にしますか？')) {
        setIsOpen(false);
        return;
    }

    setIsMarkingRead(true);
    try {
      await markAllSuggestionsAsRead();
      setUnreadCount(0);
      setSuggestions([]);
      setIsOpen(false);
      toast.dismiss(); // 既読にしたら通知も消す
      toast.success('すべて既読にしました');
    } catch (error) {
      console.error('Failed to mark as read', error);
      toast.error('既読処理に失敗しました');
    } finally {
      setIsMarkingRead(false);
    }
  };

  // 個別に閉じるだけ（既読にはしない）
  const handleDismissDialog = () => {
      setIsOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            💡 GSC改善提案 ({suggestions.length}件)
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-8 py-4">
            {suggestions.map((suggestion) => (
              <div key={suggestion.id} className="border-b last:border-0 pb-6 last:pb-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-lg truncate pr-4">
                    {suggestion.keyword || suggestion.url}
                  </h3>
                  <span className={`text-xs px-2 py-1 rounded ${
                    suggestion.outcome === 'worse' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {suggestion.outcome === 'worse' ? '悪化' : '変化なし'}
                  </span>
                </div>
                
                <div className="text-sm text-gray-500 mb-2 flex gap-4">
                   <span>順位: {suggestion.previous_position?.toFixed(1) ?? '-'} → {suggestion.current_position.toFixed(1)}</span>
                   <span>評価日: {suggestion.evaluation_date}</span>
                </div>

                <div className="prose prose-sm max-w-none bg-gray-50 p-4 rounded-md">
                  {suggestion.suggestion_summary ? (
                    <ReactMarkdown>{suggestion.suggestion_summary}</ReactMarkdown>
                  ) : (
                    <p className="text-gray-400 italic">提案内容のサマリーはありません</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="flex gap-2 sm:justify-between mt-4">
            <Button variant="outline" onClick={handleDismissDialog} disabled={isMarkingRead}>
                閉じる（未読のまま）
            </Button>
            <Button onClick={handleClose} disabled={isMarkingRead} className="gap-2">
                {isMarkingRead ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
                すべて既読にする
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

