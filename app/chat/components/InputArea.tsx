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
import { Bot, Send, Menu, PaintBucket } from 'lucide-react';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { FEATURE_FLAGS } from '@/lib/constants';

const RichEditor = dynamic(() => import('../components/RichEditor'), {
  ssr: false,
  loading: () => <p className="text-sm text-gray-500">エディターを読み込み中...</p>,
});

// 使用可能なモデル一覧
const AVAILABLE_MODELS = {
  'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2': 'キーワード選定（OpenAI）',
  ad_copy_creation: '広告文作成（Claude）',
  'gpt-4.1-nano': '広告文仕上げ（Claude）',
  lp_draft_creation: 'LPドラフト作成（Claude）',
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

interface InputAreaHeaderProps {
  isMobile: boolean;
  currentSessionTitle?: string | undefined;
  selectedModel: string;
  onModelChange: (model: string) => void;
  onMenuToggle?: (() => void) | undefined;
}

const InputAreaHeader: React.FC<InputAreaHeaderProps> = ({
  isMobile,
  currentSessionTitle,
  selectedModel,
  onModelChange,
  onMenuToggle,
}) => (
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
        <Select value={selectedModel} onValueChange={onModelChange}>
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
      </div>
    </div>
  </header>
);

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
  const [isMobile, setIsMobile] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // ✅ マークダウン記事生成を促進するプロンプト拡張
  const enhancePromptForMarkdown = (originalPrompt: string): string => {
    // 記事生成系のキーワードを検出
    const articleKeywords = [
      '記事',
      '作成',
      '書いて',
      '投稿',
      'ブログ',
      '文章',
      '内容',
      'まとめ',
      '紹介',
      '解説',
      'チュートリアル',
      'ガイド',
      '手順',
      'プロジェクト',
      '計画',
      '提案書',
      'レポート',
      '資料',
    ];

    const hasArticleKeyword = articleKeywords.some(keyword =>
      originalPrompt.toLowerCase().includes(keyword)
    );

    if (hasArticleKeyword) {
      const markdownInstructions =
        '※ 返答は**マークダウン記事形式**で構造化して作成してください。見出し（#, ##, ###）、リスト（- , 1. ）、強調（**太字**）、コード（```）を適切に使用してください。';
      return `${originalPrompt}\n\n${markdownInstructions}`;
    }

    return originalPrompt;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled) return;

    const originalMessage = input.trim();
    // ✅ プロンプトを拡張してマークダウン記事生成を促進
    const enhancedMessage = enhancePromptForMarkdown(originalMessage);

    setInput('');

    // Canvas切り替えボタンが押された時の処理
    if (canvasOpen && onToggleCanvas) {
      await onToggleCanvas();
    }

    await onSendMessage(enhancedMessage, selectedModel);
  };

  return (
    <>
      <InputAreaHeader
        isMobile={isMobile}
        currentSessionTitle={currentSessionTitle}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        onMenuToggle={onMenuToggle}
      />

      <div className="h-16" />

      {/* 入力エリア */}
      <div className="border-t p-3 bg-white">
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2 bg-slate-100 rounded-xl pr-2 pl-4 focus-within:ring-1 focus-within:ring-[#06c755]/30 transition-all duration-150">
              {FEATURE_FLAGS.USE_DYNAMIC_IMPORTS ? (
                <RichEditor
                  value={input}
                  onChange={setInput}
                  placeholder="メッセージを入力..."
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
                  placeholder="メッセージを入力..."
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
