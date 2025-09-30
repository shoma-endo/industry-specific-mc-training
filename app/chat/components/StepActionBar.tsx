'use client';
import React, { forwardRef, useImperativeHandle, useEffect } from 'react';
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
    const { getSavedFields } = useAnnotationStore();

    useImperativeHandle(ref, () => ({
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

    // 次に進むために必要なフィールドのチェック
    // ただし、手動でステップを選択した場合はチェックをバイパス
    const savedFields = currentSessionId ? getSavedFields(currentSessionId) : {};
    const requiredFields = STEP_REQUIRED_FIELDS[nextStep || displayStep] || [];
    const missingFields: string[] = [];

    if (!isManualStepSelected) {
      for (const field of requiredFields) {
        if (!savedFields[field as keyof typeof savedFields]) {
          missingFields.push(field);
        }
      }
    }

    const canProceed = isManualStepSelected || missingFields.length === 0;
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
        {!isManualStepSelected && !canProceed && (
          <div className="text-xs px-3 py-1 rounded border border-orange-200 bg-orange-50 text-orange-700">
            <span>⚠️ {missingLabels}を保存してから次のステップに進んでください</span>
          </div>
        )}
        {!isManualStepSelected && canProceed && (
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
