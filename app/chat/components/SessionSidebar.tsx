'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChatSession } from '@/domain/interfaces/IChatService';
import { ChatSessionActions } from '@/hooks/useChatSession';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, ChevronRight } from 'lucide-react';
import SessionListContent from '@/components/SessionListContent';
import { DeleteChatDialog } from '@/components/DeleteChatDialog';

interface SessionSidebarProps {
  sessions: ChatSession[];
  currentSessionId: string;
  actions: ChatSessionActions;
  isLoading?: boolean; // ✅ 読み込み状態を受け取る
}

const SessionSidebar: React.FC<SessionSidebarProps> = ({
  sessions,
  currentSessionId,
  actions,
  isLoading = false,
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
  const sessionListRef = useRef<HTMLDivElement>(null);

  // モバイル画面の検出
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  const handleSessionClick = async (sessionId: string) => {
    // ✅ 親コンポーネント（ChatLayout）が初期化を担当
    actions.loadSession(sessionId);
    if (isMobile) {
      setSheetOpen(false);
    }
  };

  const handleDeleteClick = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessionToDelete(session);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!sessionToDelete) return;

    setIsDeletingSession(true);
    try {
      await actions.deleteSession(sessionToDelete.id);
    } finally {
      setIsDeletingSession(false);
      setSessionToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleStartNewChat = async () => {
    // ✅ 親コンポーネント（ChatLayout）が初期化を担当
    actions.startNewSession();
    if (isMobile) {
      setSheetOpen(false);
    }
  };

  // ✅ 読み込み中のアニメーション表示
  const LoadingIndicator = () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex gap-2 items-center text-sm text-gray-500">
        <div
          className="w-2 h-2 bg-[#06c755] rounded-full animate-bounce"
          style={{ animationDelay: '0ms' }}
        />
        <div
          className="w-2 h-2 bg-[#06c755] rounded-full animate-bounce"
          style={{ animationDelay: '150ms' }}
        />
        <div
          className="w-2 h-2 bg-[#06c755] rounded-full animate-bounce"
          style={{ animationDelay: '300ms' }}
        />
        <span className="ml-2">履歴を読み込み中...</span>
      </div>
    </div>
  );

  // ✅ 読み込み状態の判定
  const shouldShowLoading = isLoading && sessions.length === 0;

  // SessionListContentコンポーネント用に型変換
  const adaptedSessions = sessions.map(session => ({
    id: session.id,
    title: session.title,
    updatedAt: session.updatedAt,
  }));

  const sessionListProps = {
    sessions: adaptedSessions,
    sessionId: currentSessionId,
    hoveredSessionId,
    onLoadSession: handleSessionClick,
    onDeleteClick: (
      session: { id: string; title: string; updatedAt: Date },
      e: React.MouseEvent
    ) => {
      // 元のChatSession型に戻して呼び出し
      const originalSession = sessions.find(s => s.id === session.id);
      if (originalSession) {
        handleDeleteClick(originalSession, e);
      }
    },
    onStartNewChat: handleStartNewChat,
    onHoverSession: setHoveredSessionId,
    sessionListRef,
    onToggleSidebar: () => setSidebarCollapsed(!sidebarCollapsed),
    showToggleButton: !isMobile,
  };

  // デスクトップ用サイドバー
  if (!isMobile) {
    return (
      <>
        <div className={`bg-slate-50 border-r flex-shrink-0 flex flex-col relative h-full transition-all duration-300 ${
          sidebarCollapsed ? 'w-12' : 'w-80'
        }`}>
          {sidebarCollapsed ? (
            // 折りたたみ時の表示
            <div className="flex flex-col items-center pt-20">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="h-8 w-8 hover:bg-gray-200"
                title="サイドバーを開く"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          ) : (
            // 展開時の表示
            <>
              {shouldShowLoading ? <LoadingIndicator /> : <SessionListContent {...sessionListProps} />}
            </>
          )}
        </div>

        <DeleteChatDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleDeleteConfirm}
          chatTitle={sessionToDelete?.title || ''}
          isDeleting={isDeletingSession}
        />
      </>
    );
  }

  // モバイル用シート
  return (
    <>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="absolute top-2 left-2 z-10">
            <Menu size={20} />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 max-w-[280px] sm:max-w-[280px]">
          {shouldShowLoading ? <LoadingIndicator /> : <SessionListContent {...sessionListProps} />}
        </SheetContent>
      </Sheet>

      <DeleteChatDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        chatTitle={sessionToDelete?.title || ''}
        isDeleting={isDeletingSession}
      />
    </>
  );
};

export default SessionSidebar;
