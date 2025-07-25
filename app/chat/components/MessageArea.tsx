'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage } from '@/domain/interfaces/IChatService';
import { Bot, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface MessageAreaProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onEditInCanvas?: (content: string) => void;
}

const MessageArea: React.FC<MessageAreaProps> = ({ messages, isLoading, onEditInCanvas }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  // メッセージが追加されたときに自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  // URLを検出してリンクに変換する関数
  const formatMessageContent = (content: string) => {
    const urlPattern = /https?:\/\/[^\s\n]+/g;
    const lines = content.split('\n');
    const processedContent: React.ReactNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line && urlPattern.test(line)) {
        processedContent.push(
          <a
            key={`link-${i}`}
            href={line}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline break-all"
          >
            {line}
          </a>
        );
      } else if (line) {
        processedContent.push(<span key={`text-${i}`}>{line}</span>);
      }

      if (i < lines.length - 1) {
        processedContent.push(<br key={`br-${i}`} />);
      }
    }

    return processedContent;
  };

  const LoadingIndicator = () => (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="bg-white p-6 rounded-xl shadow-sm flex flex-col items-center">
        <div className="w-10 h-10 rounded-full bg-[#06c755] flex items-center justify-center mb-4">
          <Bot size={24} className="text-white" />
        </div>
        <h3 className="text-lg font-medium mb-3">メッセージを取得中です</h3>
        <div className="flex gap-2 items-center">
          <div
            className="w-2 h-2 bg-[#06c755] rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <div
            className="w-2 h-2 bg-[#06c755] rounded-full animate-bounce"
            style={{ animationDelay: '200ms' }}
          />
          <div
            className="w-2 h-2 bg-[#06c755] rounded-full animate-bounce"
            style={{ animationDelay: '400ms' }}
          />
        </div>
      </div>
    </div>
  );

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <Bot size={48} className="text-gray-300 mb-3" />
      <h3 className="text-lg font-medium mb-1">AIアシスタントへようこそ</h3>
      <p className="text-sm text-gray-500 max-w-xs whitespace-nowrap">
        Google広告の効果を最大化するお手伝いをします。
      </p>
    </div>
  );

  const TypingIndicator = () => (
    <div className="flex items-start gap-2 mb-3 animate-in fade-in">
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-white border border-gray-200">
        <Bot size={18} className="text-[#06c755]" />
      </div>
      <div className="bg-white text-foreground p-3 rounded-2xl border border-gray-100">
        <div className="flex gap-2 items-center">
          <div className="flex gap-1 items-center">
            <div
              className="w-1.5 h-1.5 bg-[#06c755] rounded-full animate-bounce"
              style={{ animationDelay: '0ms' }}
            />
            <div
              className="w-1.5 h-1.5 bg-[#06c755] rounded-full animate-bounce"
              style={{ animationDelay: '200ms' }}
            />
            <div
              className="w-1.5 h-1.5 bg-[#06c755] rounded-full animate-bounce"
              style={{ animationDelay: '400ms' }}
            />
          </div>
          <span className="text-sm text-gray-500">メッセージを取得中です...</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-3 bg-slate-100">
      {isLoading && messages.length === 0 ? (
        <LoadingIndicator />
      ) : messages.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {messages.map((message, index) => (
            <div
              key={message.id || index}
              className="mb-4 last:mb-2 group"
              onMouseEnter={() => setHoveredMessageId(message.id || index.toString())}
              onMouseLeave={() => setHoveredMessageId(null)}
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
                    message.role === 'assistant' && onEditInCanvas && [
                      'hover:shadow-md hover:border-blue-200',
                      hoveredMessageId === (message.id || index.toString()) && 'shadow-lg border-blue-300 ring-2 ring-blue-100'
                    ]
                  )}
                >
                  <div className="whitespace-pre-wrap text-sm">
                    {formatMessageContent(message.content)}
                  </div>
                  
                  {/* Canvas編集ボタン - アシスタントメッセージのみに表示 */}
                  {message.role === 'assistant' && 
                   onEditInCanvas && 
                   hoveredMessageId === (message.id || index.toString()) && (
                    <div className="absolute -top-2 -right-2 z-20 animate-in fade-in slide-in-from-top-2 duration-200">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => onEditInCanvas(message.content)}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg border border-white/20 px-3 py-1 text-xs h-8 transition-all duration-200 hover:scale-105 hover:shadow-xl backdrop-blur-sm rounded-full"
                        title="Canvasで編集して文章を改善"
                      >
                        <Edit3 size={12} className="mr-1.5" />
                        Canvas
                      </Button>
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

          {isLoading && <TypingIndicator />}
        </>
      )}
    </div>
  );
};

export default MessageArea;