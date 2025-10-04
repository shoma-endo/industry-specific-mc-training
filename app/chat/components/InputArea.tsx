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
import { Bot, Send, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BLOG_PLACEHOLDERS, BLOG_STEP_IDS, BlogStepId } from '@/lib/constants';
import StepActionBar, { StepActionBarRef } from './StepActionBar';

// 使用可能なモデル一覧
const AVAILABLE_MODELS = {
  'ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2': 'キーワード選定',
  ad_copy_creation: '広告文作成',
  ad_copy_finishing: '広告文仕上げ',
  lp_draft_creation: 'LPドラフト作成',
  lp_improvement: 'LP改善',
  blog_creation: 'ブログ作成',
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
  disabled: boolean;
  currentSessionTitle?: string | undefined;
  currentSessionId?: string | undefined;
  isMobile?: boolean | undefined;
  onMenuToggle?: (() => void) | undefined;
  blogFlowActive?: boolean;
  blogProgress?: { currentIndex: number; total: number };
  onModelChange?: (model: string, blogStep?: BlogStepId) => void;
  blogFlowStatus?: string;
  selectedModelExternal?: string;
  initialBlogStep?: BlogStepId;
  nextStepForPlaceholder?: BlogStepId | null;
  // StepActionBar props
  shouldShowStepActionBar?: boolean;
  stepActionBarRef?: React.RefObject<StepActionBarRef | null>;
  displayStep?: BlogStepId;
  hasDetectedBlogStep?: boolean;
  onSaveClick?: () => void;
  annotationLoading?: boolean;
  stepActionBarDisabled?: boolean;
  onNextStepChange?: (nextStep: BlogStepId | null) => void;
}

const InputArea: React.FC<InputAreaProps> = ({
  onSendMessage,
  disabled,
  currentSessionTitle,
  currentSessionId,
  isMobile: propIsMobile,
  onMenuToggle,
  blogFlowActive = false,
  blogProgress,
  onModelChange,
  blogFlowStatus,
  selectedModelExternal,
  initialBlogStep,
  nextStepForPlaceholder,
  shouldShowStepActionBar,
  stepActionBarRef,
  displayStep,
  hasDetectedBlogStep,
  onSaveClick,
  annotationLoading,
  stepActionBarDisabled,
  onNextStepChange,
}) => {
  const [input, setInput] = useState('');
  const [canProceed, setCanProceed] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isModelSelected = Boolean(selectedModel);
  const isInputDisabled = disabled || !isModelSelected;

  // ブログ作成中は「次に進む」タイミングでは次ステップのプレースホルダーを表示
  const placeholderMessage = (() => {
    if (!isModelSelected) {
      return 'チャットモデルを選択してください';
    }

    if (selectedModel === 'blog_creation') {
      // ブログ作成を開始していない場合（hasDetectedBlogStep === false）はstep1を表示
      if (!hasDetectedBlogStep) {
        return BLOG_PLACEHOLDERS.blog_creation_step1;
      }

      // nextStepForPlaceholderが設定されている場合はそれを使用（StepActionBarのnextStepと連動）
      // ブログ作成進行中（hasDetectedBlogStep === true）の場合のみ適用
      if (nextStepForPlaceholder) {
        const key = `blog_creation_${nextStepForPlaceholder}` as keyof typeof BLOG_PLACEHOLDERS;
        return BLOG_PLACEHOLDERS[key];
      }

      // フォールバック: 現在のステップのプレースホルダーを表示
      // - step7（最終ステップ）の場合: step7のプレースホルダー
      // - 進行中のチャット時: 現在のステップのプレースホルダー
      const fallbackStep = initialBlogStep || 'step1';
      const key = `blog_creation_${fallbackStep}` as keyof typeof BLOG_PLACEHOLDERS;
      return BLOG_PLACEHOLDERS[key];
    }

    // 通常モデル
    return MODEL_PLACEHOLDERS[selectedModel] ?? 'チャットモデルを選択してください';
  })();

  useEffect(() => {
    if (!isModelSelected) {
      setInput('');
    }
  }, [isModelSelected]);

  // ✅ セッション変更時に状態をクリア（外部状態からの復元は既存のuseEffectに任せる）
  const prevSessionIdRef = useRef<string | undefined>(currentSessionId);
  useEffect(() => {
    // セッションIDが変更された場合のみ実行
    if (prevSessionIdRef.current !== undefined && prevSessionIdRef.current !== currentSessionId) {
      // 入力をクリア
      setInput('');

      // モデル選択をリセット（ブログフロー状態から自動復元される）
      setSelectedModel('');
    }

    // 現在のセッションIDを記録
    prevSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

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

  useEffect(() => {
    if (selectedModelExternal !== undefined && selectedModelExternal !== selectedModel) {
      setSelectedModel(selectedModelExternal);
    }
  }, [selectedModelExternal, selectedModel]);

  // 既存チャットルームを開いた際、フロー状態から自動でブログ作成モデルに合わせる（モデル選択に依存しない）
  useEffect(() => {
    if (blogFlowStatus && blogFlowStatus !== 'idle' && selectedModel !== 'blog_creation') {
      setSelectedModel('blog_creation');
      onModelChange?.('blog_creation', initialBlogStep);
    }
  }, [blogFlowStatus, selectedModel, onModelChange, initialBlogStep]);

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
    if (isInputDisabled) return;
    setInput(e.target.value);
    adjustTextareaHeight();
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isInputDisabled) return;

    const originalMessage = input.trim();
    // ブログ作成モデルの場合の制御：
    // - アクション待ち（waitingAction）での通常送信は「次のステップへ進む」扱い
    let effectiveModel: string = selectedModel;
    if (selectedModel === 'blog_creation') {
      // 通常送信は次ステップへ（初回はstep1）
      const currentStep = initialBlogStep ?? 'step1';
      const currentIdx = BLOG_STEP_IDS.indexOf(currentStep);

      // 型定義上はありえないが、実行時の安全性のため念のためチェック
      if (currentIdx === -1) {
        console.error(
          `[InputArea] initialBlogStep is invalid: ${currentStep}. Falling back to step1.`
        );
        const fallbackStep = 'step1';
        effectiveModel = `blog_creation_${fallbackStep}`;
        onModelChange?.('blog_creation', fallbackStep);
      } else {
        const shouldAdvance =
          blogFlowStatus === 'waitingAction' ||
          (blogFlowStatus === 'idle' && hasDetectedBlogStep);

        // 次のステップのインデックスを計算（現在のステップまたは次のステップ）
        const nextIdx = shouldAdvance ? currentIdx + 1 : currentIdx;
        // 配列範囲内に収める（最後のステップを超えない）
        const targetIdx = Math.min(nextIdx, BLOG_STEP_IDS.length - 1);
        const targetStep = BLOG_STEP_IDS[targetIdx] as BlogStepId;

        effectiveModel = `blog_creation_${targetStep}`;
        onModelChange?.('blog_creation', targetStep);
      }
    }

    setInput('');

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
              <span className="font-medium text-sm md:text-base truncate max-w-[120px] md:max-w-[250px]">
                {currentSessionTitle || '新しいチャット'}
              </span>
              {blogFlowActive && blogProgress && (
                <span className="text-xs text-gray-500 bg-blue-50 px-2 py-1 rounded">
                  {blogProgress.currentIndex + 1}/{blogProgress.total}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Select
              {...(isModelSelected ? { value: selectedModel } : {})}
              onValueChange={value => {
                setSelectedModel(value);
                if (value === 'blog_creation') {
                  const targetStep: BlogStepId = initialBlogStep ?? 'step1';
                  onModelChange?.(value, targetStep);
                } else {
                  onModelChange?.(value);
                }
              }}
            >
              <SelectTrigger className="w-[120px] md:w-[180px] min-w-[120px] h-9 text-xs md:text-sm border-gray-200">
                <SelectValue placeholder="選択してください" />
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
              <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded px-3 py-1">
                作成ステップは自動で進行します
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 入力エリア - レイアウトで既にpadding-topが設定されているため調整 */}
      <div className="border-t bg-white">
        {shouldShowStepActionBar && (
          <div className="px-3 py-3 border-b border-gray-200 bg-white shadow-sm">
            <StepActionBar
              ref={stepActionBarRef}
              step={displayStep}
              hasDetectedBlogStep={hasDetectedBlogStep}
              className="flex-wrap gap-3"
              disabled={stepActionBarDisabled}
              onSaveClick={onSaveClick}
              annotationLoading={annotationLoading}
              currentSessionId={currentSessionId}
              onCanProceedChange={setCanProceed}
              onNextStepChange={onNextStepChange}
            />
          </div>
        )}
        <div className="px-3 py-2">
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-2 bg-slate-100 rounded-xl pr-2 pl-4 focus-within:ring-1 focus-within:ring-[#06c755]/30 transition-all duration-150 relative">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  placeholder={placeholderMessage}
                  disabled={isInputDisabled}
                  className={cn(
                    'flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 py-2 h-auto resize-none overflow-y-auto transition-all duration-150',
                    isMobile ? 'min-h-8' : 'min-h-10',
                    input ? (isMobile ? 'max-h-[120px]' : 'max-h-[150px]') : ''
                  )}
                  rows={1}
                />
                <div className="flex gap-1">
                  <Button
                    type="submit"
                    size="icon"
                    disabled={
                      isInputDisabled ||
                      !input.trim() ||
                      (selectedModel === 'blog_creation' && shouldShowStepActionBar && !canProceed)
                    }
                    className="rounded-full size-10 bg-[#06c755] hover:bg-[#05b64b] mt-1"
                  >
                    <Send size={18} className="text-white" />
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default InputArea;
