'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  deleteChatSession,
} from '@/server/handler/actions/chat.actions';
import { useLiffContext } from '@/components/LiffProvider';
import { Bot, Send, AlertCircle, Menu } from 'lucide-react';
import { DeleteChatDialog } from '@/components/DeleteChatDialog';
import SessionListContent from '@/components/SessionListContent';
import { cn } from '@/lib/utils';
import { getUserSubscription } from '@/server/handler/actions/subscription.actions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// 使用可能なモデル一覧
const AVAILABLE_MODELS = {
  'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2': 'キーワード選定',
  // 'semrush_search': 'リサーチ→広告文作成', // semrushは契約してから使う
  ad_copy_creation: '広告文作成',
  'gpt-4.1-nano-2025-04-14': '広告文仕上げ',
  lp_draft_creation: 'LPドラフト作成',
  // 'google_search': 'Google検索', 一旦使わなくなったのでコメントアウト
};

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
  const [selectedModel, setSelectedModel] = useState<string>(
    'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2'
  );
  const [error, setError] = useState<string | null>(null);
  const [requiresSubscription, setRequiresSubscription] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
  const sessionListRef = useRef<HTMLDivElement>(null);
  const [shouldPreserveScroll, setShouldPreserveScroll] = useState(false);
  const [preservedScrollTop, setPreservedScrollTop] = useState(0);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // モバイル画面の検出
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // サブスクリプションの有効性チェック
  useEffect(() => {
    const checkSubscription = async () => {
      if (!isLoggedIn) return;

      try {
        const liffAccessToken = await getAccessToken();
        if (!liffAccessToken) {
          setError('LINE認証情報の取得に失敗しました。再ログインをお試しください。');
          setRequiresSubscription(true);
          return;
        }

        const subscriptionResult = await getUserSubscription(liffAccessToken);

        if (!subscriptionResult.success) {
          setError(subscriptionResult.error || 'サブスクリプション情報の取得に失敗しました。');
          // サーバーがエラーを返した場合、または明示的に requiresSubscription が true の場合はアクセスを制限
          setRequiresSubscription(!!subscriptionResult.requiresSubscription || true);
          return;
        }

        if (!subscriptionResult.hasActiveSubscription) {
          setError('チャット機能を利用するには有効なサブスクリプションが必要です。');
          setRequiresSubscription(true);
          return;
        }

        // hasActiveSubscription が true でも、詳細なステータスと cancelAtPeriodEnd を確認
        if (subscriptionResult.subscription) {
          const status = subscriptionResult.subscription.status;
          const cancelAtPeriodEnd = subscriptionResult.subscription.cancelAtPeriodEnd;

          const isActiveOrTrialing = status === 'active' || status === 'trialing';

          // 有効でないステータス、または有効なステータスでもキャンセル予定の場合はチャット不可
          if (!isActiveOrTrialing || cancelAtPeriodEnd) {
            setRequiresSubscription(true);
            let detailedError = 'チャット機能のご利用には、有効なサブスクリプションが必要です。';

            if (cancelAtPeriodEnd && isActiveOrTrialing) {
              detailedError =
                'サブスクリプションは解約手続き済みです。現在の請求期間終了後にチャット機能はご利用いただけなくなります。';
            } else if (status === 'canceled') {
              detailedError =
                'サブスクリプションはキャンセル済みです。新しいサブスクリプションにご登録ください。';
            } else if (status === 'past_due') {
              detailedError =
                'お支払いが確認できませんでした。お支払い情報を更新するか、新しいサブスクリプションにご登録ください。';
            } else if (!isActiveOrTrialing) {
              detailedError = `現在のサブスクリプションステータス (${status}) ではチャット機能をご利用いただけません。`;
            }
            setError(detailedError);
            return;
          }

          // 上記の条件に合致せず、チャット利用可能な場合
          setError(null);
          setRequiresSubscription(false);
        } else {
          // hasActiveSubscription: true なのに subscription オブジェクトがない場合
          // (通常はサーバー側のロジックで発生しないはずだが、念のため)
          setError('サブスクリプション情報が不完全です。サポートにお問い合わせください。');
          setRequiresSubscription(true);
          return;
        }
      } catch (err) {
        console.error('サブスクリプションチェックエラー:', err);
        setError(
          'サブスクリプション情報の確認中に予期せぬエラーが発生しました。しばらくしてから再度お試しください。'
        );
        setRequiresSubscription(true);
      }
    };

    checkSubscription();
  }, [isLoggedIn, getAccessToken]);

  // セッション一覧を取得
  const fetchSessions = useCallback(async () => {
    if (!isLoggedIn) return;

    try {
      const liffAccessToken = await getAccessToken();
      if (!liffAccessToken) {
        console.error('LINEアクセストークンが取得できません');
        return;
      }

      const result = await getChatSessions(liffAccessToken);
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
  }, [isLoggedIn, getAccessToken]);

  // ユーザーのスクロール操作を検出
  const handleUserScroll = useCallback(() => {
    setIsUserScrolling(true);
    setShouldPreserveScroll(false); // ユーザーがスクロールした場合は自動復元を無効化

    // 既存のタイマーをクリア
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // スクロール停止を検出するためのタイマー
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 150);
  }, []);

  // セッションリストにスクロールイベントを追加
  useEffect(() => {
    const element = sessionListRef.current;
    if (element) {
      element.addEventListener('scroll', handleUserScroll);
    }

    return () => {
      if (element) {
        element.removeEventListener('scroll', handleUserScroll);
      }
    };
  }, [handleUserScroll]);

  // セッション更新後にスクロール位置を復元（ユーザーがスクロール中でない場合のみ）
  useEffect(() => {
    if (shouldPreserveScroll && !isUserScrolling && sessionListRef.current) {
      sessionListRef.current.scrollTop = preservedScrollTop;
      setShouldPreserveScroll(false);
    }
  }, [sessions, shouldPreserveScroll, preservedScrollTop, isUserScrolling]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchSessions();
    }
  }, [isLoggedIn, fetchSessions]);

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

  // 削除ダイアログを開く
  const handleDeleteClick = (session: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessionToDelete(session);
    setDeleteDialogOpen(true);
  };

  // セッション削除を実行
  const handleDeleteConfirm = async () => {
    if (!sessionToDelete || !isLoggedIn) return;

    setIsDeletingSession(true);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        console.error('LINEアクセストークンが取得できません');
        return;
      }

      const result = await deleteChatSession(sessionToDelete.id, accessToken);

      if (result.success) {
        // セッション一覧から削除
        setSessions(prev => prev.filter(s => s.id !== sessionToDelete.id));

        // 削除したセッションが現在表示中の場合は新しいチャットに切り替え
        if (sessionId === sessionToDelete.id) {
          startNewChat();
        }
      } else {
        console.error('削除に失敗しました:', result.error);
        setError(result.error || 'セッションの削除に失敗しました');
      }
    } catch (error) {
      console.error('Delete session error:', error);
      setError('セッションの削除中にエラーが発生しました');
    } finally {
      setIsDeletingSession(false);
      setSessionToDelete(null);
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

  // テキストエリアの高さを自動調整する関数
  const adjustTextareaHeight = useCallback(() => {
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
  }, [input, isMobile]);

  // 入力が変更されたときにテキストエリアの高さを調整
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    adjustTextareaHeight();
  };

  // コンポーネントのマウント後にも高さを調整
  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

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
        // 新しいセッションが作成されたら、スクロール位置を保存してセッション一覧を更新
        if (sessionListRef.current) {
          setPreservedScrollTop(sessionListRef.current.scrollTop);
          setShouldPreserveScroll(true);
        }
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

  // URLを検出してリンクに変換する関数
  const formatMessageContent = (content: string) => {
    // URLを検出する正規表現パターン
    const urlPattern = /https?:\/\/[^\s\n]+/g;

    // テキストを行ごとに分割
    const lines = content.split('\n');

    // Google検索結果の形式（URL、タイトル、スニペットのパターン）を検出
    // 処理済みの行を格納
    const processedContent: React.ReactNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // URLの行を検出（Google検索結果の最初の行）
      if (line && urlPattern.test(line)) {
        // URL行の場合はリンクとして追加
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
        // URL以外の行は通常のテキストとして追加
        processedContent.push(<span key={`text-${i}`}>{line}</span>);
      }

      // 行の間に改行を追加（最後の行以外）
      if (i < lines.length - 1) {
        processedContent.push(<br key={`br-${i}`} />);
      }
    }

    return processedContent;
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
    <div className="flex h-[calc(100vh-3rem)]">
      {/* デスクトップ用サイドバー */}
      {!isMobile && (
        <div className="bg-slate-50 border-r flex-shrink-0 flex flex-col w-80 relative h-full">
          <SessionListContent
            sessions={sessions}
            sessionId={sessionId}
            hoveredSessionId={hoveredSessionId}
            onLoadSession={loadSession}
            onDeleteClick={handleDeleteClick}
            onStartNewChat={startNewChat}
            onHoverSession={setHoveredSessionId}
            sessionListRef={sessionListRef}
          />
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
            <SessionListContent
              sessions={sessions}
              sessionId={sessionId}
              hoveredSessionId={hoveredSessionId}
              onLoadSession={loadSession}
              onDeleteClick={handleDeleteClick}
              onStartNewChat={startNewChat}
              onHoverSession={setHoveredSessionId}
              sessionListRef={sessionListRef}
            />
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
                <p className="text-sm text-yellow-700">
                  {error || 'チャット機能を利用するにはサブスクリプションが必要です'}
                </p>
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
                {requiresSubscription
                  ? 'チャット機能を利用するにはサブスクリプションが必要です。'
                  : '何か質問や相談があれば、お気軽にメッセージを送ってください。'}
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
                      <div className="whitespace-pre-wrap text-sm">
                        {formatMessageContent(message.content)}
                      </div>
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

      {/* 削除確認ダイアログ */}
      <DeleteChatDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        chatTitle={sessionToDelete?.title || ''}
        isDeleting={isDeletingSession}
      />
    </div>
  );
}
