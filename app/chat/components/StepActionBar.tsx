'use client';
import React from 'react';
import { useBlogFlow } from '@/context/BlogFlowProvider';
import { BlogStepId, BLOG_STEP_LABELS, BLOG_STEP_IDS } from '@/lib/constants';
import { Button } from '@/components/ui/button';

type Props = {
  step?: BlogStepId;
  className?: string;
  disabled?: boolean;
  hasDetectedBlogStep?: boolean;
};

const StepActionBar: React.FC<Props> = ({ className, disabled, step, hasDetectedBlogStep }) => {
  const { state, openRevision } = useBlogFlow();

  // ブログフロー中は常に表示（ChatLayout側で制御済み）
  // シンプルに: アクション待ち状態なら有効化
  const effectiveStep = step ?? state.current;
  const currentIndex = BLOG_STEP_IDS.indexOf(effectiveStep);
  const fallbackIndex = BLOG_STEP_IDS.indexOf(state.current);
  const displayIndex = currentIndex >= 0 ? currentIndex : fallbackIndex;
  const displayStep = BLOG_STEP_IDS[displayIndex] ?? state.current;
  const isStepReady =
    state.flowStatus === 'waitingAction' ||
    (hasDetectedBlogStep && state.flowStatus === 'idle');
  const allowRevisionRetry = state.flowStatus === 'revising';
  const isDisabled = disabled || (!isStepReady && !allowRevisionRetry);

  // 補足テキスト用のラベル
  const currentLabel = BLOG_STEP_LABELS[displayStep] ?? '';
  const nextStep = BLOG_STEP_IDS[displayIndex + 1];
  const nextStepLabel = nextStep ? BLOG_STEP_LABELS[nextStep]?.replace(/^\d+\.\s*/, '') : '';

  return (
    <div className={`flex items-center gap-2 mt-2 ${className ?? ''}`}>
      <div className="text-xs px-3 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700">
        <span>
          現在のステップ: {currentLabel}
          {nextStepLabel
            ? ` ／ 次の${nextStepLabel}に進むにはメッセージを送信してください`
            : ''}
        </span>
      </div>
      <Button
        onClick={() => {
          openRevision();
        }}
        disabled={isDisabled}
        size="sm"
        variant="outline"
      >
        修正案を出す
      </Button>
    </div>
  );
};

export default StepActionBar;
