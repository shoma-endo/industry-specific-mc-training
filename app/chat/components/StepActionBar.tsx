'use client';
import React from 'react';
import { useBlogFlow } from '@/context/BlogFlowProvider';
import { BlogStepId, BLOG_STEP_LABELS, BLOG_STEP_IDS } from '@/lib/constants';
import { Button } from '@/components/ui/button';

type Props = {
  step: BlogStepId;
  className?: string;
  disabled?: boolean;
};

const StepActionBar: React.FC<Props> = ({ className, disabled }) => {
  const { state, next, openRevision } = useBlogFlow();

  // ブログフロー中は常に表示（ChatLayout側で制御済み）
  // シンプルに: アクション待ち状態なら有効化
  const isStepReady = state.flowStatus === 'waitingAction';
  const isDisabled = disabled || !isStepReady;

  // 次のステップのラベルを取得
  const currentIndex = BLOG_STEP_IDS.indexOf(state.current);
  const nextStep = BLOG_STEP_IDS[currentIndex + 1];

  const nextStepLabel =
    isStepReady && nextStep ? BLOG_STEP_LABELS[nextStep]?.replace(/^\d+\.\s*/, '') : '';
  const buttonText = nextStepLabel ? `次の${nextStepLabel}に進む` : '次に進む';

  return (
    <div className={`flex items-center gap-2 mt-2 ${className ?? ''}`}>
      <Button
        onClick={() => {
          console.log('StepActionBar: next button clicked');
          next();
        }}
        disabled={isDisabled}
        size="sm"
        className="px-3 py-1 bg-[#06c755] hover:bg-[#05b64b] text-white"
      >
        {buttonText}
      </Button>
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
