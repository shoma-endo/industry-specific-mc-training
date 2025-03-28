'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import liff from '@line/liff';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  startChat,
  continueChat,
  getChatSessions,
  getSessionMessages,
} from '@/server/handler/actions/chat.actions';
import { useLiffContext } from '@/components/LiffProvider';
import { Bot, Send, Trash2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
// 使用可能なモデル一覧
export const AVAILABLE_MODELS = {
  'gpt-4o': 'GPT-4o',
  'ft:gpt-4o-2024-08-06:personal::BC8R5f5J': 'カスタムGPT-4o',
  'ft:gpt-4o-2024-08-06:personal::BG2IVbFe': 'カスタムGPT-4o:20250328',
};

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SYSTEM_PROMPT = 'あなたは親切なアシスタントです。ユーザーの質問に丁寧に答えてください。';
const MAX_MESSAGES = 10;

type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
};

export default function ChatPage() {
  const router = useRouter();
  const { isLoggedIn, login, getAccessToken } = useLiffContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o');
  const [error, setError] = useState<string | null>(null);
  const [requiresSubscription, setRequiresSubscription] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const loadLatestSession = async () => {
      if (!isLoggedIn) return;

      try {
        setIsLoading(true);
        const accessToken = await liff.getAccessToken();
        if (!accessToken) {
          console.error('LINEアクセストークンが取得できません');
          setIsLoading(false);
          return;
        }

        const result = await getChatSessions(accessToken);
        if (result.error) {
          console.error(result.error);
          setIsLoading(false);
          return;
        }

        if (result.sessions && result.sessions.length > 0) {
          const latestSession = result.sessions[0];
          if (latestSession && latestSession.id) {
            setSessionId(latestSession.id);

            const messagesResult = await getSessionMessages(latestSession.id, accessToken);
            if (!messagesResult.error && messagesResult.messages) {
              const uiMessages: Message[] = messagesResult.messages.map(msg => ({
                role: msg.role === 'system' ? 'assistant' : (msg.role as 'user' | 'assistant'),
                content: msg.content,
                timestamp: new Date(msg.createdAt),
              }));

              setMessages(uiMessages);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load chat session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLatestSession();
  }, [isLoggedIn]);

  // メッセージが追加されたら自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // テキストエリアの高さを自動調整する関数
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 150); // 最大高さを150pxに制限
      textarea.style.height = `${newHeight}px`;
    }
  };

  // 入力が変更されたときにテキストエリアの高さを調整
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    adjustTextareaHeight();
  };

  // コンポーネントのマウント後にも高さを調整
  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setError(null);
    setRequiresSubscription(false);

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
      const liffAccessToken = await getAccessToken();
      const recentMessages = messages.slice(-MAX_MESSAGES);

      const response =
        messages.length === 0 || !sessionId
          ? await startChat({
              systemPrompt: SYSTEM_PROMPT,
              userMessage: input,
              model: selectedModel,
              liffAccessToken,
            })
          : await continueChat({
              sessionId,
              messages: [...recentMessages, userMessage].map(msg => ({
                role: msg.role,
                content: msg.content,
              })),
              userMessage: input,
              model: selectedModel,
              liffAccessToken,
            });

      if (response.sessionId && !sessionId) {
        setSessionId(response.sessionId);
      }

      if (response.error) {
        console.error(response.error);
        setError(response.error);

        if (response.requiresSubscription) {
          setRequiresSubscription(true);
        }
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
      setError('すみません、エラーが発生しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
      // 入力欄にフォーカス
      inputRef.current?.focus();
    }
  };

  const clearChat = () => {
    if (confirm('会話履歴をクリアしますか？')) {
      setMessages([]);
      setSessionId('');
      setError(null);
      setRequiresSubscription(false);
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

  const goToSubscription = () => {
    router.push('/subscription');
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
      {/* サブスクリプション必要アラート */}
      {requiresSubscription && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 m-3">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm text-yellow-700">{error}</p>
              <div className="mt-2">
                <Button variant="outline" size="sm" onClick={goToSubscription} className="text-xs">
                  サブスクリプションに登録する
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 一般エラーアラート */}
      {error && !requiresSubscription && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 m-3">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto p-3 bg-slate-100">
        {isLoading && messages.length === 0 ? (
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
                ></div>
                <div
                  className="w-2 h-2 bg-[#06c755] rounded-full animate-bounce"
                  style={{ animationDelay: '200ms' }}
                ></div>
                <div
                  className="w-2 h-2 bg-[#06c755] rounded-full animate-bounce"
                  style={{ animationDelay: '400ms' }}
                ></div>
              </div>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Bot size={48} className="text-gray-300 mb-3" />
            <h3 className="text-lg font-medium mb-1">AIアシスタントへようこそ</h3>
            <p className="text-sm text-gray-500 max-w-xs">
              何か質問や相談があれば、お気軽にメッセージを送ってください。
            </p>
            {requiresSubscription && (
              <div className="mt-4">
                <Button variant="default" size="sm" onClick={goToSubscription} className="text-xs">
                  サブスクリプションに登録する
                </Button>
              </div>
            )}
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
                  {message.role !== 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-white border border-gray-200">
                      <Bot size={18} className="text-[#06c755]" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[85%] p-3 rounded-2xl',
                      message.role === 'user'
                        ? 'bg-[#06c755] text-white'
                        : 'bg-white text-gray-800 border border-gray-100'
                    )}
                  >
                    <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                  </div>
                  {message.role === 'user' && (
                    <div className="opacity-0 w-8 h-8">
                      {/* スペーサー要素 - ユーザーメッセージの右側に表示されるLINEと同様の余白を確保 */}
                    </div>
                  )}
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

            {/* AIの入力中表示 */}
            {isLoading && (
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
                      ></div>
                      <div
                        className="w-1.5 h-1.5 bg-[#06c755] rounded-full animate-bounce"
                        style={{ animationDelay: '200ms' }}
                      ></div>
                      <div
                        className="w-1.5 h-1.5 bg-[#06c755] rounded-full animate-bounce"
                        style={{ animationDelay: '400ms' }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-500">メッセージを取得中です...</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア */}
      <div className="border-t p-3 bg-white">
        <form onSubmit={e => e.preventDefault()} className="relative">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="モデルを選択" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AVAILABLE_MODELS).map(([modelId, modelName]) => (
                    <SelectItem key={modelId} value={modelId}>
                      {modelName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start gap-2 bg-slate-100 rounded-xl pr-2 pl-4 focus-within:ring-1 focus-within:ring-[#06c755]/30">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                placeholder="メッセージを入力..."
                disabled={isLoading}
                className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 py-2 h-auto min-h-10 max-h-[150px] resize-none overflow-y-auto"
                rows={1}
                style={{ overflow: 'auto' }}
              />

              <Button
                onClick={handleSubmit}
                size="icon"
                disabled={isLoading || !input.trim()}
                className="rounded-full size-10 bg-[#06c755] hover:bg-[#05b64b] mt-1"
              >
                <Send size={18} className="text-white" />
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
