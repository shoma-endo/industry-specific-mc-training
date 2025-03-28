'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import liff from '@line/liff';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  startChat,
  continueChat,
  getChatSessions,
  getSessionMessages,
} from '@/server/handler/actions/chat.actions';
import { useLiffContext } from '@/components/LiffProvider';
import { Bot, Send, AlertCircle, PlusCircle, Menu } from 'lucide-react';
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

type Session = {
  id: string;
  title: string;
  updatedAt: Date;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // モバイル画面の検出
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // セッション一覧を取得
  const fetchSessions = async () => {
    if (!isLoggedIn) return;

    try {
      const accessToken = await liff.getAccessToken();
      if (!accessToken) {
        console.error('LINEアクセストークンが取得できません');
        return;
      }

      const result = await getChatSessions(accessToken);
      if (result.error) {
        console.error(result.error);
        return;
      }

      if (result.sessions) {
        // セッションにタイトルがなければ、「新しい会話」またはタイムスタンプをタイトルとして設定
        const formattedSessions: Session[] = result.sessions.map(session => ({
          id: session.id,
          title:
            session.title ||
            `新しい会話 ${new Date(session.lastMessageAt || session.createdAt).toLocaleDateString()}`,
          updatedAt: new Date(session.lastMessageAt || session.createdAt),
        }));
        setSessions(formattedSessions);
      }
    } catch (error) {
      console.error('Failed to fetch chat sessions:', error);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchSessions();
    }
  }, [isLoggedIn]);

  // 特定のセッションのメッセージを読み込む
  const loadSession = async (sessionId: string) => {
    if (!isLoggedIn || !sessionId) return;

    try {
      setIsLoading(true);
      const accessToken = await liff.getAccessToken();
      if (!accessToken) {
        console.error('LINEアクセストークンが取得できません');
        setIsLoading(false);
        return;
      }

      setSessionId(sessionId);
      const messagesResult = await getSessionMessages(sessionId, accessToken);

      if (!messagesResult.error && messagesResult.messages) {
        const uiMessages: Message[] = messagesResult.messages.map(msg => ({
          role: msg.role === 'system' ? 'assistant' : (msg.role as 'user' | 'assistant'),
          content: msg.content,
          timestamp: new Date(msg.createdAt),
        }));

        setMessages(uiMessages);
      }

      // モバイル表示の場合はセッション選択後にシートを閉じる
      if (isMobile) {
        setSheetOpen(false);
      }
    } catch (error) {
      console.error('Failed to load chat session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 新しいチャットを開始
  const startNewChat = () => {
    setSessionId('');
    setMessages([]);
    setError(null);
    setRequiresSubscription(false);

    // モバイル表示の場合は新規チャット開始後にシートを閉じる
    if (isMobile) {
      setSheetOpen(false);
    }
  };

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

      // 入力がない場合は初期高さを固定（スマホでは小さく、PCでは標準サイズ）
      if (!input) {
        textarea.style.height = isMobile ? '32px' : '40px';
        return;
      }

      // 入力がある場合は、内容に応じて高さを調整（最大値は制限）
      const maxHeight = isMobile ? 120 : 150;
      const textareaHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${textareaHeight}px`;
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
        // 新しいセッションが作成されたら、セッション一覧を更新
        fetchSessions();
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
      textareaRef.current?.focus();
    }
  };

  const formatTime = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

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

  // サイドバーの内容
  const SessionListContent = () => (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-medium text-lg flex items-center gap-2">
          <Bot size={20} className="text-[#06c755]" />
          チャット履歴
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          <Button
            variant="outline"
            onClick={startNewChat}
            className="w-full mb-4 flex items-center gap-2 bg-white border-gray-200 hover:bg-gray-50"
          >
            <PlusCircle size={16} className="text-[#06c755]" />
          </Button>

          {sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">履歴がありません</div>
          ) : (
            <div className="space-y-2">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className={cn(
                    'w-full text-left px-3 py-3 rounded-lg hover:bg-gray-100 transition',
                    sessionId === session.id
                      ? 'bg-[#e6f9ef] text-[#06c755] font-medium'
                      : 'bg-white'
                  )}
                >
                  <div className="flex flex-col">
                    <span className="truncate text-sm">{session.title}</span>
                    <span className="text-xs text-gray-500 mt-1">
                      {formatDate(session.updatedAt)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      {/* デスクトップ用サイドバー */}
      {!isMobile && (
        <div className="bg-slate-50 border-r flex-shrink-0 flex flex-col w-80 relative h-full">
          <SessionListContent />
        </div>
      )}

      {/* モバイル用シート */}
      {isMobile && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="absolute top-2 left-2 z-10">
              <Menu size={20} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 max-w-[280px] sm:max-w-[280px]">
            <SessionListContent />
          </SheetContent>
        </Sheet>
      )}

      {/* チャットメイン部分 */}
      <div className="flex-1 flex flex-col">
        {/* ヘッダー */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border shadow-sm h-16">
          <div className="container mx-auto px-4 h-full flex items-center justify-between">
            {/* ロゴとタイトル */}
            <div className="flex items-center space-x-3">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSheetOpen(!sheetOpen)}
                  aria-label="メニュー"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <div className="flex items-center space-x-2">
                <Bot className="h-6 w-6 text-[#06c755]" />
                <span className="font-medium text-sm md:text-base truncate max-w-[150px] md:max-w-[300px]">
                  {(sessionId && sessions.find(s => s.id === sessionId)?.title) || '新しいチャット'}
                </span>
              </div>
            </div>

            {/* アクションメニュー */}
            <div className="flex items-center space-x-2">
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-[120px] md:w-[180px] h-9 text-xs md:text-sm border-gray-200">
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
          </div>
        </header>

        {/* 固定ヘッダーの高さ分のスペース */}
        <div className="h-16"></div>

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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToSubscription}
                    className="text-xs"
                  >
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
                  <Button
                    variant="default"
                    size="sm"
                    onClick={goToSubscription}
                    className="text-xs"
                  >
                    サブスクリプションに登録する
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
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
              <div className="flex items-start gap-2 bg-slate-100 rounded-xl pr-2 pl-4 focus-within:ring-1 focus-within:ring-[#06c755]/30">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  placeholder="メッセージを入力..."
                  disabled={isLoading}
                  className={cn(
                    'flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 py-2 h-auto resize-none overflow-y-auto',
                    isMobile ? 'min-h-8' : 'min-h-10',
                    input ? (isMobile ? 'max-h-[120px]' : 'max-h-[150px]') : ''
                  )}
                  rows={1}
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
    </div>
  );
}
