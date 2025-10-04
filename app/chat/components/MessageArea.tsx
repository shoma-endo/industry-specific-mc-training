'use client';

import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '@/domain/interfaces/IChatService';
import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import BlogPreviewTile from './common/BlogPreviewTile';
import { BLOG_STEP_LABELS } from '@/lib/constants';
import { extractBlogStepFromModel, normalizeCanvasContent } from '@/lib/blog-canvas';

interface MessageAreaProps {
  messages: ChatMessage[];
  isLoading: boolean;
  renderAfterMessage?: (message: ChatMessage) => React.ReactNode;
  blogFlowActive?: boolean;
  onOpenCanvas?: (message: ChatMessage) => void;
}

const MessageArea: React.FC<MessageAreaProps> = ({
  messages,
  isLoading,
  renderAfterMessage,
  onOpenCanvas,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // URL/Markdownリンクを検出してリンクに変換（hrefは純粋なURLのみ）
  const formatMessageContent = (content: string) => {
    const markdownLinkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    const rawUrlPattern = /https?:\/\/[^\s)\]]+/g;
    const lines = content.split('\n');
    const processed: React.ReactNode[] = [];

    const renderLine = (line: string, lineIndex: number) => {
      if (!line) return [];

      const nodes: React.ReactNode[] = [];
      let cursor = 0;
      let match: RegExpExecArray | null;

      markdownLinkPattern.lastIndex = 0;
      while ((match = markdownLinkPattern.exec(line)) !== null) {
        const [fullMatch, label, href] = match;
        const start = match.index;
        if (start > cursor) {
          nodes.push(<span key={`text-${lineIndex}-${cursor}`}>{line.slice(cursor, start)}</span>);
        }
        nodes.push(
          <a
            key={`md-${lineIndex}-${start}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {label}
          </a>
        );
        cursor = start + fullMatch.length;
      }

      const remainder = line.slice(cursor);
      if (remainder) {
        let rawCursor = 0;
        rawUrlPattern.lastIndex = 0;
        let rawMatch: RegExpExecArray | null;
        while ((rawMatch = rawUrlPattern.exec(remainder)) !== null) {
          const start = rawMatch.index;
          const end = start + rawMatch[0].length;
          if (start > rawCursor) {
            nodes.push(
              <span key={`text-${lineIndex}-${cursor + rawCursor}`}>
                {remainder.slice(rawCursor, start)}
              </span>
            );
          }

          let href = rawMatch[0];
          const trailingPunctuationMatch = href.match(/[.,!?]+$/);
          let trailing = '';
          if (trailingPunctuationMatch) {
            trailing = trailingPunctuationMatch[0];
            href = href.slice(0, -trailing.length);
          }

          nodes.push(
            <a
              key={`url-${lineIndex}-${cursor + start}`}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline break-all"
            >
              {href}
            </a>
          );

          if (trailing) {
            nodes.push(<span key={`trail-${lineIndex}-${cursor + end}`}>{trailing}</span>);
          }

          rawCursor = end;
        }

        if (rawCursor < remainder.length) {
          nodes.push(
            <span key={`tail-${lineIndex}-${cursor + rawCursor}`}>
              {remainder.slice(rawCursor)}
            </span>
          );
        }
      }

      return nodes;
    };

    lines.forEach((line, index) => {
      processed.push(...renderLine(line, index));
      if (index < lines.length - 1) {
        processed.push(<br key={`br-${index}`} />);
      }
    });

    return processed;
  };

  // blog_creation_***モデルで生成されたメッセージかチェック
  const isBlogMessage = (message: ChatMessage): boolean => {
    return message.role === 'assistant' && extractBlogStepFromModel(message.model) !== null;
  };

  const derivePreviewMeta = (message: ChatMessage) => {
    const step = extractBlogStepFromModel(message.model);
    if (!step) return null;

    const normalized = normalizeCanvasContent(message.content ?? '');
    const lines = normalized
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    const headingLine = lines.find(line => /^#+\s*/.test(line));
    const titleSource = headingLine ?? lines[0] ?? 'ブログ下書き';
    const title = titleSource.replace(/^#+\s*/, '').trim() || 'ブログ下書き';

    const bodyLines = lines.filter(line => line !== headingLine);
    const body = bodyLines
      .map(line => line.replace(/^[-*]\s+/, '').replace(/^[0-9]+\.\s+/, ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    const excerpt = body.length > 140 ? `${body.slice(0, 140)}…` : body;

    return {
      step,
      title,
      excerpt,
    };
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

  const EmptyState = () => {
    // 通常の空状態
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <Bot size={48} className="text-gray-300 mb-3" />
        <h3 className="text-lg font-medium mb-1">AIアシスタントへようこそ</h3>
        <p className="text-sm text-gray-500 max-w-xs whitespace-nowrap">
          Google広告の効果を最大化するお手伝いをします。
        </p>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 bg-slate-100">
      {isLoading && messages.length === 0 ? (
        <ActivityIndicator variant="full" label="メッセージを取得中です" />
      ) : messages.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {messages.map((message, index) => {
            const blogPreviewMeta = isBlogMessage(message) ? derivePreviewMeta(message) : null;
            const openHandler =
              blogPreviewMeta && onOpenCanvas ? () => onOpenCanvas(message) : null;

            return (
              <React.Fragment key={message.id || index}>
                <div className="mb-4 last:mb-2 group">
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
                        'max-w-[85%] rounded-2xl relative transition-all duration-200',
                        message.role === 'user'
                          ? 'bg-[#06c755] text-white p-3'
                          : blogPreviewMeta
                            ? 'bg-transparent text-gray-800 p-0'
                            : 'bg-white text-gray-800 border border-gray-100 p-3'
                      )}
                    >
                      {blogPreviewMeta ? (
                        <BlogPreviewTile
                          stepLabel={BLOG_STEP_LABELS[blogPreviewMeta.step] ?? 'ブログ'}
                          title={blogPreviewMeta.title}
                          excerpt={blogPreviewMeta.excerpt}
                          {...(openHandler ? { onOpen: openHandler } : {})}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap text-sm">
                          {formatMessageContent(message.content)}
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
                {renderAfterMessage?.(message)}
              </React.Fragment>
            );
          })}

          <div ref={messagesEndRef} />

          {isLoading && <ActivityIndicator variant="inline" label="メッセージを取得中です..." />}
        </>
      )}
    </div>
  );
};

export default MessageArea;
