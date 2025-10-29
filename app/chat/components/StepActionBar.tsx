'use client';
import React, { forwardRef, useImperativeHandle, useEffect } from 'react';
import { BlogStepId, BLOG_STEP_LABELS, BLOG_STEP_IDS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { BookMarked, BookOpen, Loader2 } from 'lucide-react';

interface StepActionBarProps {
  step?: BlogStepId | undefined;
  className?: string | undefined;
  disabled?: boolean | undefined;
  hasDetectedBlogStep?: boolean | undefined;
  onSaveClick?: (() => void) | undefined;
  annotationLoading?: boolean | undefined;
  onNextStepChange?: ((nextStep: BlogStepId | null) => void) | undefined;
  flowStatus?: string | undefined;
  onLoadBlogArticle?: (() => Promise<void>) | undefined;
  isLoadBlogArticleLoading?: boolean;
}

export interface StepActionBarRef {
  getCurrentStepInfo: () => { currentStep: BlogStepId; nextStep: BlogStepId | null };
}

const StepActionBar = forwardRef<StepActionBarRef, StepActionBarProps>(
  (
    {
      className,
      disabled,
      step,
      hasDetectedBlogStep,
      onSaveClick,
      annotationLoading,
      onNextStepChange,
      flowStatus = 'idle',
      onLoadBlogArticle,
      isLoadBlogArticleLoading = false,
    },
    ref
  ) => {
    const actualStep = step ?? (BLOG_STEP_IDS[0] as BlogStepId);
    const actualIndex = BLOG_STEP_IDS.indexOf(actualStep);
    const displayIndex = actualIndex >= 0 ? actualIndex : 0;
    const displayStep = BLOG_STEP_IDS[displayIndex] ?? actualStep ?? BLOG_STEP_IDS[0];
    const nextStep = BLOG_STEP_IDS[displayIndex + 1] ?? null;

    useImperativeHandle(ref, () => ({
      getCurrentStepInfo: () => ({
        currentStep: displayStep,
        nextStep: nextStep ?? null,
      }),
    }));

    // UI制御
    const isStepReady = flowStatus === 'waitingAction' || (hasDetectedBlogStep && flowStatus === 'idle');
    const isDisabled = disabled || !isStepReady;
    const isStep7 = displayStep === 'step7';
    const showLoadButton = isStep7 && typeof onLoadBlogArticle === 'function';

    // ラベル
    const currentLabel = BLOG_STEP_LABELS[displayStep] ?? '';
    const nextStepLabel = nextStep ? BLOG_STEP_LABELS[nextStep]?.replace(/^\d+\.\s*/, '') : '';

    // nextStep の変更を親コンポーネントに通知
    useEffect(() => {
      onNextStepChange?.(nextStep);
    }, [nextStep, onNextStepChange]);

    return (
      <div className={`flex items-center gap-2 ${className ?? ''}`}>
        <div className="text-xs px-3 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700">
          <span>
            現在のステップ: {currentLabel}
            {nextStepLabel ? ` ／ 次の${nextStepLabel}に進むにはメッセージを送信してください` : ''}
          </span>
        </div>
        {showLoadButton && (
          <Button
            onClick={() => {
              if (isDisabled || isLoadBlogArticleLoading) return;
              void onLoadBlogArticle?.();
            }}
            disabled={isDisabled || isLoadBlogArticleLoading}
            size="sm"
            variant="outline"
            className="flex items-center gap-1 bg-white text-gray-900 hover:bg-gray-100"
          >
            {isLoadBlogArticleLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <BookOpen size={14} />
            )}
            <span>{isLoadBlogArticleLoading ? '取得中…' : 'ブログ記事取得'}</span>
          </Button>
        )}
        <Button
          onClick={() => onSaveClick?.()}
          disabled={isDisabled || !onSaveClick || annotationLoading}
          size="sm"
          className="flex items-center gap-1 bg-black text-white hover:bg-black/90"
        >
          <BookMarked size={14} />
          <span>{annotationLoading ? '読み込み中...' : 'ブログ保存'}</span>
        </Button>
      </div>
    );
  }
);

StepActionBar.displayName = 'StepActionBar';

export default StepActionBar;
