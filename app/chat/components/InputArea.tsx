'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bot, Send, Menu, PaintBucket, Info, BookOpen, Loader2, PinOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { FEATURE_FLAGS } from '@/lib/constants';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  BLOG_HINTS_DETAIL,
  BLOG_HINTS_SHORT,
  BLOG_PLACEHOLDERS,
  BLOG_STEP_IDS,
  BLOG_STEP_LABELS,
} from '@/lib/constants';
import { getAllSavedMessagesSA, unsaveMessageSA } from '@/server/handler/actions/chat.actions';

const RichEditor = dynamic(() => import('../components/RichEditor'), {
  ssr: false,
  loading: () => <p className="text-sm text-gray-500">エディターを読み込み中...</p>,
});

// 使用可能なモデル一覧
const AVAILABLE_MODELS = {
  'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2': 'キーワード選定',
  ad_copy_creation: '広告文作成',
  ad_copy_finishing: '広告文仕上げ',
  lp_draft_creation: 'LPドラフト作成',
  lp_improvement: 'LP改善',
  blog_creation: 'ブログ作成',
};

// モデルごとの補足説明（短文）
const MODEL_HINTS_SHORT: Record<string, string> = {
  'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2': '変数: なし（分類専用）',
  ad_copy_creation: '変数: 事業者情報',
  ad_copy_finishing: '変数: 事業者情報',
  lp_draft_creation: '変数: 事業者情報',
  lp_improvement: '変数: 事業者情報',
  ...BLOG_HINTS_SHORT,
};

// モデルごとの詳細ツールチップ
const MODEL_HINTS_DETAIL: Record<string, string> = {
  'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2':
    '入力キーワードの分類に特化したモデルで、プロンプト変数は使用しません。',
  ad_copy_creation:
    '登録済みの事業者情報（プロフィール/5W2H/ペルソナ など）をプロンプト変数として使用します。',
  ad_copy_finishing:
    '登録済みの事業者情報（プロフィール/5W2H/ペルソナ など）をプロンプト変数として使用します。',
  lp_draft_creation:
    '登録済みの事業者情報（プロフィール/5W2H/ペルソナ など）をプロンプト変数として使用します。',
  lp_improvement:
    '登録済みの事業者情報（プロフィール/5W2H/ペルソナ など）をプロンプト変数として使用します。',
  ...BLOG_HINTS_DETAIL,
};

// モデルごとのプレースホルダー文言
const MODEL_PLACEHOLDERS: Record<string, string> = {
  'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2': 'SEOキーワードを改行区切りで入力してください',
  ad_copy_creation: '競合の広告文を入力してください',
  ad_copy_finishing: '広告文の改善・修正指示などを入力してください',
  lp_draft_creation: '広告見出しと説明文を入力してください',
  lp_improvement: 'LPの改善・修正指示などを入力してください',
  ...BLOG_PLACEHOLDERS,
};

interface InputAreaProps {
  onSendMessage: (content: string, model: string) => Promise<void>;
  onToggleCanvas: () => void;
  disabled: boolean;
  canvasOpen: boolean;
  currentSessionTitle?: string | undefined;
  isMobile?: boolean | undefined;
  onMenuToggle?: (() => void) | undefined;
  getAccessToken: () => Promise<string>;
  onLoadSession?: (sessionId: string) => Promise<void>;
}

const InputArea: React.FC<InputAreaProps> = ({
  onSendMessage,
  onToggleCanvas,
  disabled,
  canvasOpen,
  currentSessionTitle,
  isMobile: propIsMobile,
  onMenuToggle,
  getAccessToken,
  onLoadSession,
}) => {
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>(
    'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2'
  );
  const [selectedBlogStep, setSelectedBlogStep] = useState<
    'step1' | 'step2' | 'step3' | 'step4' | 'step5' | 'step6' | 'step7'
  >('step1');
  const [isMobile, setIsMobile] = useState(false);
  const [savedDialogOpen, setSavedDialogOpen] = useState(false);
  const [savedList, setSavedList] = useState<Array<{ id: string; content: string; created_at: number; session_id: string }>>([]);
  const [isLoadingSavedList, setIsLoadingSavedList] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // UI表示用のモデルキー（ブログ作成時はステップを反映）
  const displayModelKey =
    selectedModel === 'blog_creation' ? `blog_creation_${selectedBlogStep}` : selectedModel;

  // モバイル画面の検出（propsから渡された値を優先、フォールバックで独自検出）
  useEffect(() => {
    if (propIsMobile !== undefined) {
      setIsMobile(propIsMobile);
      return;
    }

    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, [propIsMobile]);

  // テキストエリアの高さを自動調整する関数
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';

      if (!input) {
        textarea.style.height = isMobile ? '32px' : '40px';
        return;
      }

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

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled) return;

    const originalMessage = input.trim();
    const effectiveModel =
      selectedModel === 'blog_creation' ? `blog_creation_${selectedBlogStep}` : selectedModel;

    setInput('');

    // Canvas切り替えボタンが押された時の処理
    if (canvasOpen && onToggleCanvas) {
      await onToggleCanvas();
    }

    await onSendMessage(originalMessage, effectiveModel);
  };

  // 保存一覧ダイアログを開く
  const openSavedDialog = async () => {
    try {
      setIsLoadingSavedList(true);
      setSavedDialogOpen(true);
      const token = await getAccessToken();
      const result = await getAllSavedMessagesSA(token);
      setSavedList(result.items || []);
    } catch (error) {
      console.error('保存一覧の取得に失敗:', error);
      setSavedList([]);
    } finally {
      setIsLoadingSavedList(false);
    }
  };

  // テキスト省略用ヘルパー関数
  const truncate = (s: string, n = 80) => (s.length > n ? s.slice(0, n) + '…' : s);

  // セッション移動のハンドラ
  const handleSessionClick = async (sessionId: string) => {
    if (onLoadSession) {
      try {
        await onLoadSession(sessionId);
        setSavedDialogOpen(false); // ダイアログを閉じる
      } catch (error) {
        console.error('セッションの読み込みに失敗しました:', error);
      }
    }
  };

  // 保存一覧から保存解除
  const handleUnsaveFromList = async (messageId: string) => {
    try {
      const token = await getAccessToken();
      const result = await unsaveMessageSA({ messageId, liffAccessToken: token });
      if (result?.success) {
        setSavedList(prev => prev.filter(item => item.id !== messageId));
      } else {
        console.error('保存解除に失敗しました:', result?.error);
      }
    } catch (error) {
      console.error('保存解除に失敗しました:', error);
    }
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border shadow-sm h-16">
        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isMobile && onMenuToggle && (
              <Button variant="ghost" size="icon" onClick={onMenuToggle} aria-label="メニュー">
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <div className="flex items-center space-x-2">
              <Bot className="h-6 w-6 text-[#06c755]" />
              <span className="font-medium text-sm md:text-base truncate max-w-[120px] md:max-w-[250px]">
                {currentSessionTitle || '新しいチャット'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={openSavedDialog}
                disabled={isLoadingSavedList}
                className="h-8 px-2 text-xs bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                {isLoadingSavedList ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <BookOpen className="h-4 w-4 mr-1" />
                )}
                <span className="hidden sm:inline">保存済チャット</span>
              </Button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-[120px] md:w-[180px] min-w-[120px] h-9 text-xs md:text-sm border-gray-200">
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

            {selectedModel === 'blog_creation' && (
              <Select
                value={selectedBlogStep}
                onValueChange={v =>
                  setSelectedBlogStep(
                    v as 'step1' | 'step2' | 'step3' | 'step4' | 'step5' | 'step6' | 'step7'
                  )
                }
              >
                <SelectTrigger className="w-[160px] md:w-[220px] min-w-[140px] h-9 text-xs md:text-sm border-gray-200">
                  <SelectValue placeholder="ステップを選択" />
                </SelectTrigger>
                <SelectContent>
                  {BLOG_STEP_IDS.map(stepId => (
                    <SelectItem key={stepId} value={stepId}>
                      {BLOG_STEP_LABELS[stepId]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* モデル補足（短文 + ツールチップ） */}
            <div className="hidden md:flex items-center gap-1 text-xs text-gray-500">
              <span>{MODEL_HINTS_SHORT[displayModelKey] ?? ''}</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="モデル補足説明" className="inline-flex">
                      <Info className="h-4 w-4 text-gray-400" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[360px] text-xs leading-relaxed">
                    <p>{MODEL_HINTS_DETAIL[displayModelKey] ?? ''}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </header>

      {/* 入力エリア - レイアウトで既にpadding-topが設定されているため調整 */}
      <div className="border-t px-3 py-2 bg-white">
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2 bg-slate-100 rounded-xl pr-2 pl-4 focus-within:ring-1 focus-within:ring-[#06c755]/30 transition-all duration-150">
              {FEATURE_FLAGS.USE_DYNAMIC_IMPORTS ? (
                <RichEditor
                  value={input}
                  onChange={setInput}
                  placeholder={MODEL_PLACEHOLDERS[displayModelKey] ?? 'メッセージを入力...'}
                  disabled={disabled}
                  className={cn(
                    'flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 py-2 h-auto resize-none overflow-y-auto transition-all duration-150',
                    isMobile ? 'min-h-8' : 'min-h-10',
                    input ? (isMobile ? 'max-h-[120px]' : 'max-h-[150px]') : ''
                  )}
                />
              ) : (
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  placeholder={MODEL_PLACEHOLDERS[displayModelKey] ?? 'メッセージを入力...'}
                  disabled={disabled}
                  className={cn(
                    'flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 py-2 h-auto resize-none overflow-y-auto transition-all duration-150',
                    isMobile ? 'min-h-8' : 'min-h-10',
                    input ? (isMobile ? 'max-h-[120px]' : 'max-h-[150px]') : ''
                  )}
                  rows={1}
                />
              )}

              <div className="flex gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={onToggleCanvas}
                  className={cn(
                    'rounded-full size-10 mt-1',
                    canvasOpen
                      ? 'bg-[#06c755] text-white hover:bg-[#05b64b]'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                  aria-label="Canvasを切り替え"
                >
                  <PaintBucket size={18} />
                </Button>

                <Button
                  type="submit"
                  size="icon"
                  disabled={disabled || !input.trim()}
                  className="rounded-full size-10 bg-[#06c755] hover:bg-[#05b64b] mt-1"
                >
                  <Send size={18} className="text-white" />
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* 保存チャット一覧ダイアログ */}
      <Dialog open={savedDialogOpen} onOpenChange={setSavedDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">保存したチャット一覧</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-2">
            <TooltipProvider>
              {isLoadingSavedList ? (
                <div className="text-center py-12">
                  <Loader2 className="h-8 w-8 text-gray-400 mx-auto mb-4 animate-spin" />
                  <div className="text-gray-500 text-lg">保存チャットを読み込み中...</div>
                </div>
              ) : savedList.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <div className="text-gray-500 text-lg">保存されたチャットはありません</div>
                  <div className="text-gray-400 text-sm mt-2">
                    チャットメッセージの「…」メニューから保存してください
                  </div>
                </div>
              ) : (
                savedList.map(item => (
                  <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer" onClick={() => handleSessionClick(item.session_id)}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="text-gray-800 leading-relaxed">
                          {truncate(item.content, 80)}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent 
                        className="max-w-[90vw] sm:max-w-2xl max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-words p-4"
                        side="top"
                      >
                        {item.content}
                      </TooltipContent>
                    </Tooltip>
                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100">
                      <div className="text-xs text-gray-500">
                        {new Date(item.created_at).toLocaleString('ja-JP', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                          ID: {item.session_id.slice(-8)}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnsaveFromList(item.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded"
                          title="保存を解除"
                        >
                          <PinOff size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </TooltipProvider>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InputArea;
