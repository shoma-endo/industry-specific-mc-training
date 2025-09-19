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
  const { state, openRevision } = useBlogFlow();

  // ブログフロー中は常に表示（ChatLayout側で制御済み）
  // シンプルに: アクション待ち状態なら有効化
  const isStepReady = state.flowStatus === 'waitingAction';
  const isDisabled = disabled || !isStepReady;

  // 補足テキスト用のラベル
  const currentLabel = BLOG_STEP_LABELS[state.current] ?? '';
  const currentIndex = BLOG_STEP_IDS.indexOf(state.current);
  const nextStep = BLOG_STEP_IDS[currentIndex + 1];
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
