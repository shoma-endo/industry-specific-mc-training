'use client';

import React, { memo } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Session = {
  id: string;
  title: string;
  updatedAt: Date;
};

interface SessionListContentProps {
  sessions: Session[];
  sessionId: string;
  hoveredSessionId: string | null;
  onLoadSession: (id: string) => void;
  onDeleteClick: (session: Session, e: React.MouseEvent) => void;
  onStartNewChat: () => void;
  onHoverSession: (sessionId: string | null) => void;
  sessionListRef: React.RefObject<HTMLDivElement | null>;
}

const SessionListContent = memo(function SessionListContent({
  sessions,
  sessionId,
  hoveredSessionId,
  onLoadSession,
  onDeleteClick,
  onStartNewChat,
  onHoverSession,
  sessionListRef,
}: SessionListContentProps) {
  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return '今日';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return '昨日';
    } else {
      return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto" ref={sessionListRef}>
        <div className="p-3 pt-20">
          <Button
            variant="outline"
            onClick={onStartNewChat}
            className="w-full mb-4 flex items-center gap-2 bg-white border-gray-200 hover:bg-gray-50"
          >
            <PlusCircle size={16} className="text-[#06c755]" />
            新規チャット
          </Button>

          {sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">履歴がありません</div>
          ) : (
            <div className="space-y-2">
              {sessions.map(session => (
                <div
                  key={session.id}
                  className={cn(
                    'group relative rounded-lg transition',
                    sessionId === session.id
                      ? 'bg-[#e6f9ef] text-[#06c755] font-medium'
                      : 'bg-white hover:bg-gray-100'
                  )}
                  onMouseEnter={() => onHoverSession(session.id)}
                  onMouseLeave={() => onHoverSession(null)}
                >
                  <button
                    onClick={() => onLoadSession(session.id)}
                    className="w-full text-left px-3 py-3 pr-10"
                  >
                    <div className="flex flex-col">
                      <span className="truncate text-sm">{session.title}</span>
                      <span className="text-xs text-gray-500 mt-1">
                        {formatDate(session.updatedAt)}
                      </span>
                    </div>
                  </button>
                  
                  {/* 削除ボタン - ホバー時に表示 */}
                  {hoveredSessionId === session.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 opacity-70 hover:opacity-100 hover:bg-red-100 hover:text-red-600"
                      onClick={(e) => onDeleteClick(session, e)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default SessionListContent;