'use client';
import React, { forwardRef, useImperativeHandle, useEffect, useMemo } from 'react';
import { useBlogFlow } from '@/context/BlogFlowProvider';
import { BlogStepId, BLOG_STEP_LABELS, BLOG_STEP_IDS, STEP_REQUIRED_FIELDS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { useAnnotationStore } from '@/store/annotationStore';
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
  step?: BlogStepId | undefined;
  className?: string | undefined;
  disabled?: boolean | undefined;
  hasDetectedBlogStep?: boolean | undefined;
  availableSteps?: BlogStepId[] | undefined;
  onStepChange?: ((step: BlogStepId) => void) | undefined;
  selectedStep?: BlogStepId | null | undefined;
  onSaveClick?: (() => void) | undefined;
  annotationLoading?: boolean | undefined;
  currentSessionId?: string | undefined;
  onCanProceedChange?: ((canProceed: boolean) => void) | undefined;
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
      availableSteps = [],
      onStepChange,
      selectedStep,
      onSaveClick,
      annotationLoading,
      currentSessionId,
      onCanProceedChange,
    },
    ref
  ) => {
    const { state } = useBlogFlow();
    const savedFieldFlags = useAnnotationStore(state => state.sessions);
    const savedFields = useMemo(() => {
      if (!currentSessionId) return {};
      return savedFieldFlags[currentSessionId] ?? {};
    }, [currentSessionId, savedFieldFlags]);

    const resolveStepIndex = (value: BlogStepId | null | undefined): number => {
      if (!value) return -1;
      return BLOG_STEP_IDS.indexOf(value);
    };

    const actualStep = step ?? state.current;
    const actualIndexRaw = resolveStepIndex(actualStep);
    const actualIndex = actualIndexRaw >= 0 ? actualIndexRaw : 0;

    const manualIndexRaw = resolveStepIndex(selectedStep);
    const hasManualSelection = selectedStep !== null && manualIndexRaw >= 0;

    const displayIndex = hasManualSelection ? manualIndexRaw : actualIndex;
    const fallbackStep = actualStep ?? BLOG_STEP_IDS[0];
    const displayStep = BLOG_STEP_IDS[displayIndex] ?? fallbackStep;

    const isPastStepSelected = hasManualSelection && manualIndexRaw < actualIndex;
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
    const allowRevisionRetry = state.flowStatus === 'revising';
    const isDisabled = disabled || (!isStepReady && !allowRevisionRetry);

    // ラベル
    const currentLabel = BLOG_STEP_LABELS[displayStep] ?? '';
    const nextStepLabel = nextStep ? BLOG_STEP_LABELS[nextStep]?.replace(/^\d+\.\s*/, '') : '';

    // ✅ 次に進むために必要なフィールドのチェック（過去のステップは対象外）
    const targetStepForValidation = nextStep ?? displayStep;
    const requiredFields = STEP_REQUIRED_FIELDS[targetStepForValidation] || [];
    const missingFields: string[] = [];

    if (!isPastStepSelected) {
      for (const field of requiredFields) {
        if (!savedFields[field as keyof typeof savedFields]) {
          missingFields.push(field);
        }
      }
    }

    const canProceed = isPastStepSelected || missingFields.length === 0;
    const fieldLabels: Record<string, string> = {
      needs: 'ニーズ',
      persona: 'デモグラ・ペルソナ',
      goal: 'ゴール',
      prep: 'PREP',
      basic_structure: '基本構成',
      opening_proposal: '書き出し案',
    };
    const missingLabels = missingFields.map(f => fieldLabels[f] || f).join('、');

    // canProceed の変更を親コンポーネントに通知
    useEffect(() => {
      onCanProceedChange?.(canProceed);
    }, [canProceed, onCanProceedChange]);

    return (
      <div className={`flex items-center gap-2 ${className ?? ''}`}>
        {/* 過去のステップ選択時はメッセージ非表示 */}
        {!isPastStepSelected && !canProceed && (
          <div className="text-xs px-3 py-1 rounded border border-orange-200 bg-orange-50 text-orange-700">
            <span>⚠️ {missingLabels}を保存してから次のステップに進んでください</span>
          </div>
        )}
        {!isPastStepSelected && !hasManualSelection && canProceed && (
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
          onClick={() => onSaveClick?.()}
          disabled={isDisabled || !onSaveClick || annotationLoading}
          size="sm"
          variant={!canProceed ? 'default' : 'outline'}
          className={`flex items-center gap-1 ${!canProceed ? 'bg-orange-500 hover:bg-orange-600 text-white border-orange-500' : ''}`}
        >
          <BookMarked size={14} />
          <span>
            {annotationLoading ? '読み込み中...' : canProceed ? 'ブログ保存' : 'ブログ保存（必須）'}
          </span>
        </Button>
        {availableSteps.length >= 2 && onStepChange && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Select
                    value={selectedStep ?? displayStep}
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
