'use client';

import React, { useState, useRef } from 'react';
import { ChatSession, ChatSessionSearchResult } from '@/domain/interfaces/IChatService';
import { ChatSessionActions } from '@/hooks/useChatSession';
import { Button } from '@/components/ui/button';
import { ChevronRight, Loader2 } from 'lucide-react';
import SessionListContent from '@/components/SessionListContent';
import { DeleteChatDialog } from '@/components/DeleteChatDialog';

interface SessionSidebarProps {
  sessions: ChatSession[];
  currentSessionId: string;
  actions: ChatSessionActions;
  isLoading?: boolean; // ✅ 読み込み状態を受け取る
  isMobile: boolean;
  searchQuery: string;
  searchResults: ChatSessionSearchResult[];
  searchError: string | null;
  isSearching: boolean;
}

const SessionSidebar: React.FC<SessionSidebarProps> = ({
  sessions,
  currentSessionId,
  actions,
  isLoading = false,
  isMobile,
  searchQuery,
  searchResults,
  searchError,
  isSearching,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
  const sessionListRef = useRef<HTMLDivElement>(null);

  const handleSessionClick = async (sessionId: string) => {
    // ✅ 親コンポーネント（ChatLayout）が初期化を担当
    actions.loadSession(sessionId);
  };

  const handleSearchResultClick = async (sessionId: string) => {
    await actions.loadSession(sessionId);
    actions.clearSearch();
  };

  const handleStartNewChat = () => {
    actions.startNewSession();
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

  // ✅ 読み込み中のアニメーション表示
  const LoadingIndicator = () => (
    <div className="flex h-full min-h-full items-center justify-center py-12">
      <div className="flex flex-col items-center gap-3 text-sm text-gray-500 text-center">
        <div className="flex gap-2 items-center">
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
        </div>
        <span>履歴を読み込み中...</span>
      </div>
    </div>
  );

  // ✅ 読み込み状態の判定
  const shouldShowLoading = isLoading && sessions.length === 0;
  const showSearchResults = searchQuery.trim().length > 0;

  const formatRelativeDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return '今日';
    }

    if (date.toDateString() === yesterday.toDateString()) {
      return '昨日';
    }

    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  };

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

  const renderSearchResultList = () => {
    if (isSearching) {
      return (
        <div className="px-4 py-6 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin text-[#06c755]" />
          <span>検索中です...</span>
        </div>
      );
    }

    if (searchError) {
      return <div className="px-4 py-6 text-sm text-red-500">{searchError}</div>;
    }

    if (searchResults.length === 0) {
      return (
        <div className="px-4 py-12 text-center text-sm text-gray-400">チャットが見つかりません</div>
      );
    }

    return (
      <div className="px-4 py-4 space-y-2">
        {searchResults.map(result => (
          <button
            key={result.sessionId}
            onClick={() => handleSearchResultClick(result.sessionId)}
            className="w-full text-left bg-white hover:bg-gray-100 rounded-lg px-3 py-3"
          >
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium truncate">{result.title}</span>
              {result.wordpressTitle && (
                <span className="text-xs text-gray-500 truncate">{result.wordpressTitle}</span>
              )}
              {result.canonicalUrl && (
                <span className="text-xs text-gray-400 truncate">{result.canonicalUrl}</span>
              )}
              <span className="text-xs text-gray-400">
                更新: {formatRelativeDate(result.lastMessageAt)}
              </span>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const renderListArea = () => {
    if (showSearchResults) {
      return renderSearchResultList();
    }
    if (shouldShowLoading) {
      return <LoadingIndicator />;
    }
    return <SessionListContent {...sessionListProps} />;
  };

  let sidebarContent: React.ReactNode;

  if (!isMobile) {
    sidebarContent = (
      <div
        className={`bg-slate-50 border-r flex-shrink-0 flex flex-col relative h-full transition-all duration-300 ${
          sidebarCollapsed ? 'w-12' : 'w-80'
        }`}
      >
        {sidebarCollapsed ? (
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
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto">{renderListArea()}</div>
          </div>
        )}
      </div>
    );
  } else {
    sidebarContent = (
      <div className="flex flex-col h-full bg-slate-50">
        <div className="flex-1 overflow-y-auto">{renderListArea()}</div>
      </div>
    );
  }

  if (!isMobile) {
    sidebarContent = <div className="h-full pt-16">{sidebarContent}</div>;
  }

  return (
    <>
      {sidebarContent}
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
