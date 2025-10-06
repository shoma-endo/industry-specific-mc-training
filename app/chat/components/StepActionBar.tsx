'use client';
import React, { forwardRef, useImperativeHandle, useEffect } from 'react';
import { useBlogFlow } from '@/context/BlogFlowProvider';
import { BlogStepId, BLOG_STEP_LABELS, BLOG_STEP_IDS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { BookMarked } from 'lucide-react';

type Props = {
  step?: BlogStepId | undefined;
  className?: string | undefined;
  disabled?: boolean | undefined;
  hasDetectedBlogStep?: boolean | undefined;
  onSaveClick?: (() => void) | undefined;
  annotationLoading?: boolean | undefined;
  onNextStepChange?: ((nextStep: BlogStepId | null) => void) | undefined;
};

export type StepActionBarRef = {
  getCurrentStepInfo: () => { currentStep: BlogStepId; nextStep: BlogStepId | null };
};

const StepActionBar = forwardRef<StepActionBarRef, Props>(
  (
    {
      className,
      disabled,
      step,
      hasDetectedBlogStep,
      onSaveClick,
      annotationLoading,
      onNextStepChange,
    },
    ref
  ) => {
    const { state } = useBlogFlow();

    const actualStep = step ?? state.current;
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
    const isStepReady =
      state.flowStatus === 'waitingAction' || (hasDetectedBlogStep && state.flowStatus === 'idle');
    const isDisabled = disabled || !isStepReady;

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
        <Button
          onClick={() => onSaveClick?.()}
          disabled={isDisabled || !onSaveClick || annotationLoading}
          size="sm"
          variant="outline"
          className="flex items-center gap-1"
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
