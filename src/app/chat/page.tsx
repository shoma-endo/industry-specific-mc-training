'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { startChat, continueChat } from '@/server/handler/actions/chat.actions';
import { useLiffContext } from '@/components/LiffProvider';
import { Bot, User, Send, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const SYSTEM_PROMPT = 'あなたは親切なアシスタントです。ユーザーの質問に丁寧に答えてください。';
const MAX_MESSAGES = 10;

type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
};

export default function ChatPage() {
  const { isLoggedIn, login } = useLiffContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // メッセージが追加されたら自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // ユーザーメッセージを即時追加
    const userMessage = {
      role: 'user' as const,
      content: input,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const recentMessages = messages.slice(-MAX_MESSAGES);
      const response =
        messages.length === 0
          ? await startChat({ systemPrompt: SYSTEM_PROMPT, userMessage: input })
          : await continueChat({ messages: [...recentMessages, userMessage], userMessage: input });

      if (response.error) {
        console.error(response.error);
        return;
      }

      // AIの応答を追加
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: response.message,
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error('Chat error:', error);
      // エラーメッセージを表示
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'すみません、エラーが発生しました。もう一度お試しください。',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      // 入力欄にフォーカス
      inputRef.current?.focus();
    }
  };

  const clearChat = () => {
    if (confirm('会話履歴をクリアしますか？')) {
      setMessages([]);
    }
  };

  const formatTime = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // 複数のメッセージをまとめて表示するのに使う補助関数
  const shouldShowTimestamp = (index: number) => {
    if (index === messages.length - 1) return true;
    if (index < 0 || index >= messages.length - 1) return false;

    const currentMsg = messages[index];
    const nextMsg = messages[index + 1];

    // 次のメッセージが別のロールの場合、または5分以上の間隔がある場合
    if (!currentMsg || !nextMsg) return true;

    return (
      currentMsg.role !== nextMsg.role ||
      !currentMsg.timestamp ||
      !nextMsg.timestamp ||
      nextMsg.timestamp.getTime() - currentMsg.timestamp.getTime() > 5 * 60 * 1000
    );
  };

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3rem)]">
        <Card className="p-6 text-center max-w-xs w-full shadow-lg rounded-xl">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bot size={32} className="text-primary" />
          </div>
          <h2 className="text-lg font-semibold mb-3">AIアシスタントにログイン</h2>
          <p className="text-sm text-muted-foreground mb-4">
            AIアシスタントを利用するにはLINEでログインしてください。
          </p>
          <Button onClick={login} className="w-full">
            LINEでログイン
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto p-3 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Bot size={48} className="text-gray-300 mb-3" />
            <h3 className="text-lg font-medium mb-1">AIアシスタントへようこそ</h3>
            <p className="text-sm text-gray-500 max-w-xs">
              何か質問や相談があれば、お気軽にメッセージを送ってください。
            </p>
          </div>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={clearChat}
              className="mb-3 text-xs ml-auto flex items-center gap-1"
            >
              <Trash2 size={14} />
              履歴を削除
            </Button>

            {messages.map((message, index) => (
              <div key={index} className="mb-4 last:mb-2">
                <div
                  className={cn(
                    'flex items-start gap-2',
                    message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  )}
                >
                  <div
                    className={cn(
                      'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center',
                      message.role === 'user' ? 'bg-primary' : 'bg-green-500'
                    )}
                  >
                    {message.role === 'user' ? (
                      <User size={16} className="text-white" />
                    ) : (
                      <Bot size={16} className="text-white" />
                    )}
                  </div>
                  <div
                    className={cn(
                      'max-w-[85%] p-3 rounded-lg shadow-sm',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-tr-none'
                        : 'bg-white text-foreground rounded-tl-none border border-gray-100'
                    )}
                  >
                    <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                  </div>
                </div>

                {/* タイムスタンプ (条件付きで表示) */}
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
          </>
        )}

        {/* AIの入力中表示 */}
        {isLoading && (
          <div className="flex items-start gap-2 mb-3 animate-in fade-in">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-500 flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <div className="bg-white text-foreground p-3 rounded-lg rounded-tl-none border border-gray-100 shadow-sm">
              <div className="flex gap-1 items-center">
                <div
                  className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                ></div>
                <div
                  className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '200ms' }}
                ></div>
                <div
                  className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '400ms' }}
                ></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア */}
      <div className="border-t p-2 bg-background">
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex items-center gap-2 bg-gray-50 rounded-full pr-1 pl-4 border shadow-sm focus-within:ring-1 focus-within:ring-primary/30 focus-within:border-primary/60">
            <Input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="メッセージを入力..."
              disabled={isLoading}
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 py-5 h-auto"
            />

            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              size="sm"
              className="rounded-full w-8 h-8 p-0 flex items-center justify-center"
            >
              <Send size={16} />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
