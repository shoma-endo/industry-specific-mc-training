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
import { Bot, Send, Menu, PaintBucket, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { FEATURE_FLAGS } from '@/lib/constants';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BLOG_HINTS_DETAIL,
  BLOG_HINTS_SHORT,
  BLOG_PLACEHOLDERS,
  BLOG_STEP_IDS,
  BLOG_STEP_LABELS,
} from '@/lib/constants';

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
}

const InputArea: React.FC<InputAreaProps> = ({
  onSendMessage,
  onToggleCanvas,
  disabled,
  canvasOpen,
  currentSessionTitle,
  isMobile: propIsMobile,
  onMenuToggle,
}) => {
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>(
    'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2'
  );
  const [selectedBlogStep, setSelectedBlogStep] = useState<
    'step1' | 'step2' | 'step3' | 'step4' | 'step5' | 'step6' | 'step7' | 'step8'
  >('step1');
  const [isMobile, setIsMobile] = useState(false);
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
              <span className="font-medium text-sm md:text-base truncate max-w-[150px] md:max-w-[300px]">
                {currentSessionTitle || '新しいチャット'}
              </span>
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
                    v as
                      | 'step1'
                      | 'step2'
                      | 'step3'
                      | 'step4'
                      | 'step5'
                      | 'step6'
                      | 'step7'
                      | 'step8'
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
    </>
  );
};

export default InputArea;
