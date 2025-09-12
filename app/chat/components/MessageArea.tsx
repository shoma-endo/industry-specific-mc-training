'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage } from '@/domain/interfaces/IChatService';
import { Bot, Edit3, MoreHorizontal, Pin, PinOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface MessageAreaProps {
  sessionId?: string;
  messages: ChatMessage[];
  isLoading: boolean;
  onEditInCanvas?: (content: string) => void;
  onShowCanvas?: (content: string) => void;
  initialSavedIds?: string[];
  onToggleSave?: (messageId: string, next: boolean) => Promise<void> | void;
}

const MessageArea: React.FC<MessageAreaProps> = ({
  sessionId,
  messages,
  isLoading,
  onEditInCanvas,
  onShowCanvas,
  initialSavedIds = [],
  onToggleSave,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  // 保存状態・メニュー開閉状態
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set(initialSavedIds));
  const [menuOpenForId, setMenuOpenForId] = useState<string | null>(null);

  // sessionIdまたはinitialSavedIdsが変更されたときに保存状態をリセット
  useEffect(() => {
    setSavedIds(new Set(initialSavedIds));
  }, [initialSavedIds, sessionId]);

  // メッセージが追加されたときに自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 保存状態をトグルする関数
  const handleToggleSave = async (messageId: string) => {
    if (!messageId) return;
    const next = !savedIds.has(messageId);
    try {
      await onToggleSave?.(messageId, next);
      const newSavedIds = new Set(savedIds);
      if (next) {
        newSavedIds.add(messageId);
      } else {
        newSavedIds.delete(messageId);
      }
      setSavedIds(newSavedIds);
    } catch (error) {
      console.error('保存状態の更新に失敗しました:', error);
    } finally {
      setMenuOpenForId(null);
    }
  };

  const formatTime = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const shouldShowTimestamp = (index: number) => {
    if (index === messages.length - 1) return true;
    if (index < 0 || index >= messages.length - 1) return false;

    const currentMsg = messages[index];
    const nextMsg = messages[index + 1];

    if (!currentMsg || !nextMsg) return true;

    return (
      currentMsg.role !== nextMsg.role ||
      !currentMsg.timestamp ||
      !nextMsg.timestamp ||
      nextMsg.timestamp.getTime() - currentMsg.timestamp.getTime() > 5 * 60 * 1000
    );
  };

  // URLを検出してリンクに変換する関数（行内のURLのみをhrefに使用）
  const formatMessageContent = (content: string) => {
    const urlPattern = /https?:\/\/[^\s\n]+/g; // 絶対URLのみ
    const lines = content.split('\n');
    const processedContent: React.ReactNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) {
        if (i < lines.length - 1) processedContent.push(<br key={`br-${i}`} />);
        continue;
      }

      let lastIndex = 0;
      let match: RegExpExecArray | null;
      const localRegex = new RegExp(urlPattern); // 新しいRegExpでlastIndexを独立
      localRegex.lastIndex = 0;

      const segments: React.ReactNode[] = [];
      while ((match = urlPattern.exec(line)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (start > lastIndex) {
          segments.push(<span key={`text-${i}-${lastIndex}`}>{line.slice(lastIndex, start)}</span>);
        }
        const href = match[0];
        segments.push(
          <a
            key={`link-${i}-${start}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline break-all"
          >
            {href}
          </a>
        );
        lastIndex = end;
      }

      if (lastIndex < line.length) {
        segments.push(<span key={`tail-${i}`}>{line.slice(lastIndex)}</span>);
      }

      processedContent.push(...segments);
      if (i < lines.length - 1) {
        processedContent.push(<br key={`br-${i}`} />);
      }
    }

    return processedContent;
  };

  const Dots: React.FC<{ size?: 'sm' | 'md'; colorClass?: string }> = ({
    size = 'md',
    colorClass = 'bg-[#06c755]',
  }) => {
    const dim = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';
    return (
      <div className="flex gap-2 items-center">
        <div
          className={`${dim} ${colorClass} rounded-full animate-bounce`}
          style={{ animationDelay: '0ms' }}
        />
        <div
          className={`${dim} ${colorClass} rounded-full animate-bounce`}
          style={{ animationDelay: '200ms' }}
        />
        <div
          className={`${dim} ${colorClass} rounded-full animate-bounce`}
          style={{ animationDelay: '400ms' }}
        />
      </div>
    );
  };

  const ActivityIndicator: React.FC<{ variant: 'full' | 'inline'; label?: string }> = ({
    variant,
    label,
  }) => {
    if (variant === 'inline') {
      return (
        <div className="flex items-start gap-2 mb-3 animate-in fade-in">
          <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-white border border-gray-200">
            <Bot size={18} className="text-[#06c755]" />
          </div>
          <div className="bg-white text-foreground p-3 rounded-2xl border border-gray-100">
            <div className="flex gap-2 items-center">
              <Dots size="sm" />
              <span className="text-sm text-gray-500">{label ?? 'メッセージを取得中です...'}</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="bg-white p-6 rounded-xl shadow-sm flex flex-col items-center">
          <div className="w-10 h-10 rounded-full bg-[#06c755] flex items-center justify-center mb-4">
            <Bot size={24} className="text-white" />
          </div>
          <h3 className="text-lg font-medium mb-3">{label ?? 'メッセージを取得中です'}</h3>
          <Dots size="md" />
        </div>
      </div>
    );
  };

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <Bot size={48} className="text-gray-300 mb-3" />
      <h3 className="text-lg font-medium mb-1">AIアシスタントへようこそ</h3>
      <p className="text-sm text-gray-500 max-w-xs whitespace-nowrap">
        Google広告の効果を最大化するお手伝いをします。
      </p>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-3 bg-slate-100">
      {isLoading && messages.length === 0 ? (
        <ActivityIndicator variant="full" label="メッセージを取得中です" />
      ) : messages.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {messages.map((message, index) => (
            <div
              key={message.id || index}
              className="mb-4 last:mb-2 group"
              onMouseEnter={() => setHoveredMessageId(message.id || index.toString())}
              onMouseLeave={() => {
                setHoveredMessageId(null);
                setMenuOpenForId(null);
              }}
            >
              <div
                className={cn(
                  'flex items-start gap-2 relative',
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                {message.role !== 'user' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-white border border-gray-200">
                    <Bot size={18} className="text-[#06c755]" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[85%] p-3 rounded-2xl relative transition-all duration-200',
                    message.role === 'user'
                      ? 'bg-[#06c755] text-white'
                      : 'bg-white text-gray-800 border border-gray-100',
                    // アシスタントメッセージのホバー効果
                    message.role === 'assistant' &&
                      onEditInCanvas && [
                        'hover:shadow-md hover:border-blue-200',
                        hoveredMessageId === (message.id || index.toString()) &&
                          'shadow-lg border-blue-300 ring-2 ring-blue-100',
                      ]
                  )}
                >
                  <div className="whitespace-pre-wrap text-sm">
                    {formatMessageContent(message.content)}
                  </div>

                  {/* 「…」メニューボタン - アシスタントメッセージのみに表示 */}
                  {message.role === 'assistant' &&
                    hoveredMessageId === (message.id || index.toString()) && (
                      <div className="absolute -top-2 -right-2 z-20 animate-in fade-in slide-in-from-top-2 duration-200">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setMenuOpenForId(prev =>
                              prev === (message.id || index.toString()) ? null : message.id || index.toString()
                            )
                          }
                          className="h-8 w-8 p-0 bg-white shadow-md border border-gray-200 hover:shadow-lg transition-all duration-200"
                          title="その他のオプション"
                        >
                          <MoreHorizontal size={16} />
                        </Button>

                        {/* ドロップダウンメニュー */}
                        {menuOpenForId === (message.id || index.toString()) && (
                          <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-30">
                            {/* Canvasで編集 */}
                            {(onEditInCanvas || onShowCanvas) && (
                              <button
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors"
                                onClick={() => {
                                  if (onShowCanvas) {
                                    onShowCanvas(message.content);
                                  } else if (onEditInCanvas) {
                                    onEditInCanvas(message.content);
                                  }
                                  setMenuOpenForId(null);
                                }}
                              >
                                <Edit3 size={14} className="text-blue-600" />
                                <span>Canvasで編集</span>
                              </button>
                            )}
                            
                            {/* 保存/保存解除 */}
                            <button
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors"
                              onClick={() => message.id && handleToggleSave(message.id)}
                            >
                              {message.id && savedIds.has(message.id) ? (
                                <>
                                  <PinOff size={14} className="text-red-500" />
                                  <span>保存を解除</span>
                                </>
                              ) : (
                                <>
                                  <Pin size={14} className="text-green-600" />
                                  <span>保存する</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                </div>
                {message.role === 'user' && <div className="opacity-0 w-8 h-8" />}
              </div>

              {shouldShowTimestamp(index) && (
                <div
                  className={cn(
                    'text-[10px] text-gray-400 mt-1 px-2',
                    message.role === 'user' ? 'text-right' : 'text-left'
                  )}
                >
                  {formatTime(message.timestamp)}
                </div>
              )}
            </div>
          ))}

          <div ref={messagesEndRef} />

          {isLoading && <ActivityIndicator variant="inline" label="メッセージを取得中です..." />}
        </>
      )}
    </div>
  );
};

export default MessageArea;
