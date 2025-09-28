'use client';
import React, { forwardRef, useImperativeHandle } from 'react';
import { useBlogFlow } from '@/context/BlogFlowProvider';
import { BlogStepId, BLOG_STEP_LABELS, BLOG_STEP_IDS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BookMarked } from 'lucide-react';

type Props = {
  step?: BlogStepId;
  className?: string;
  disabled?: boolean;
  hasDetectedBlogStep?: boolean;
  availableSteps?: BlogStepId[];
  onStepChange?: (step: BlogStepId) => void;
  selectedStep?: BlogStepId | null;
  onRevisionClick?: () => void;
  onSaveClick?: () => void;
  annotationLoading?: boolean;
};

export type StepActionBarRef = {
  triggerRevisionMode: () => void;
  getCurrentStepInfo: () => { currentStep: BlogStepId; nextStep: BlogStepId | null };
};

const StepActionBar = forwardRef<StepActionBarRef, Props>(
  (
    {
      className,
      disabled,
      step,
      hasDetectedBlogStep,
      availableSteps = [],
      onStepChange,
      selectedStep,
      onRevisionClick,
      onSaveClick,
      annotationLoading,
    },
    ref
  ) => {
    const { state, openRevision } = useBlogFlow();

    useImperativeHandle(ref, () => ({
      triggerRevisionMode: () => {
        onRevisionClick?.();
      },
      getCurrentStepInfo: () => ({
        currentStep: displayStep,
        nextStep: nextStep || null,
      }),
    }));

    // ブログフロー中は常に表示（ChatLayout側で制御済み）
    // シンプルに: アクション待ち状態なら有効化
    const effectiveStep = selectedStep ?? step ?? state.current;
    const currentIndex = BLOG_STEP_IDS.indexOf(effectiveStep);
    const fallbackIndex = BLOG_STEP_IDS.indexOf(state.current);
    const displayIndex = currentIndex >= 0 ? currentIndex : fallbackIndex;
    const displayStep = BLOG_STEP_IDS[displayIndex] ?? state.current;
    const isStepReady =
      state.flowStatus === 'waitingAction' || (hasDetectedBlogStep && state.flowStatus === 'idle');
    const allowRevisionRetry = state.flowStatus === 'revising';
    const isDisabled = disabled || (!isStepReady && !allowRevisionRetry);

    // 補足テキスト用のラベル
    const currentLabel = BLOG_STEP_LABELS[displayStep] ?? '';

    // 手動でステップが選択されている場合は、そのステップベースでnextStepを計算
    const baseStepForNext = selectedStep ?? displayStep;
    const baseIndex = BLOG_STEP_IDS.indexOf(baseStepForNext);
    const nextStep =
      baseIndex >= 0 ? BLOG_STEP_IDS[baseIndex + 1] : BLOG_STEP_IDS[displayIndex + 1];
    const nextStepLabel = nextStep ? BLOG_STEP_LABELS[nextStep]?.replace(/^\d+\.\s*/, '') : '';

    // Selectで過去のステップを選択している場合は情報を表示しない
    const isManualStepSelected = selectedStep !== null;

    return (
      <div className={`flex items-center gap-2 mt-2 ${className ?? ''}`}>
        {!isManualStepSelected && (
          <div className="text-xs px-3 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700">
            <span>
              現在のステップ: {currentLabel}
              {nextStepLabel
                ? ` ／ 次の${nextStepLabel}に進むにはメッセージを送信してください`
                : ''}
            </span>
          </div>
        )}
        <Button
          onClick={() => {
            openRevision();
            onRevisionClick?.();
          }}
          disabled={isDisabled}
          size="sm"
          variant="outline"
        >
          修正案を出す
        </Button>
        <Button
          onClick={() => onSaveClick?.()}
          disabled={isDisabled || !onSaveClick || annotationLoading}
          size="sm"
          variant="outline"
          className="flex items-center gap-1"
        >
          <BookMarked size={14} />
          <span>{annotationLoading ? '読み込み中...' : '保存'}</span>
        </Button>
        {availableSteps.length >= 2 && onStepChange && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Select
                    value={selectedStep ?? effectiveStep}
                    onValueChange={(value: BlogStepId) => {
                      onStepChange(value);
                    }}
                    disabled={isDisabled}
                  >
                    <SelectTrigger className="w-[200px] h-8 text-xs">
                      <SelectValue placeholder="ステップを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSteps.map(stepId => (
                        <SelectItem key={stepId} value={stepId}>
                          {BLOG_STEP_LABELS[stepId]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>過去のステップを選択してそこから再開できます</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  }
);

StepActionBar.displayName = 'StepActionBar';

export default StepActionBar;
