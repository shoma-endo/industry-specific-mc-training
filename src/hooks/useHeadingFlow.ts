'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import * as headingActions from '@/server/actions/heading-flow.actions';
import type { SessionHeadingSection } from '@/types/heading-flow';
import type { BlogStepId } from '@/lib/constants';

interface UseHeadingFlowParams {
  sessionId: string | null;
  latestBlogStep: BlogStepId | null;
  isSessionLoading: boolean;
  step5Content: string | null;
  getAccessToken: () => Promise<string>;
  resolvedCanvasStep: BlogStepId | null;
}

interface UseHeadingFlowReturn {
  headingSections: SessionHeadingSection[];
  isSavingHeading: boolean;
  isHeadingInitInFlight: boolean;
  hasAttemptedHeadingInit: boolean;
  headingInitError: string | null;
  activeHeadingIndex: number | undefined;
  activeHeading: SessionHeadingSection | undefined;
  fetchHeadingSections: (sessionId: string) => Promise<SessionHeadingSection[]>;
  /**
   * 見出しセクションを保存する。
   * @param content 保存するコンテンツ（canvasStreamingContent || canvasContent）
   */
  handleSaveHeadingSection: (content: string) => Promise<void>;
  handleRetryHeadingInit: () => void;
}

export function useHeadingFlow({
  sessionId,
  latestBlogStep,
  isSessionLoading,
  step5Content,
  getAccessToken,
  resolvedCanvasStep,
}: UseHeadingFlowParams): UseHeadingFlowReturn {
  const [headingSections, setHeadingSections] = useState<SessionHeadingSection[]>([]);
  const [isSavingHeading, setIsSavingHeading] = useState(false);
  const [isHeadingInitInFlight, setIsHeadingInitInFlight] = useState(false);
  const [hasAttemptedHeadingInit, setHasAttemptedHeadingInit] = useState(false);
  const [headingInitError, setHeadingInitError] = useState<string | null>(null);

  // セッション切り替え時の競合防止用 ref
  const currentSessionIdRef = useRef(sessionId);
  useEffect(() => {
    currentSessionIdRef.current = sessionId;
  }, [sessionId]);

  const activeHeadingIndex = useMemo(() => {
    if (headingSections.length === 0) return undefined;
    const index = headingSections.findIndex(s => !s.isConfirmed);
    // 未確定がなければ全確定済み → アクティブな見出しなし
    return index >= 0 ? index : undefined;
  }, [headingSections]);

  const activeHeading =
    activeHeadingIndex !== undefined ? headingSections[activeHeadingIndex] : undefined;

  const fetchHeadingSections = useCallback(
    async (sid: string): Promise<SessionHeadingSection[]> => {
      const liffAccessToken = await getAccessToken();
      const res = await headingActions.getHeadingSections({ sessionId: sid, liffAccessToken });
      // セッション切り替え時の競合防止
      if (res.success && res.data && sid === currentSessionIdRef.current) {
        setHeadingSections(res.data);
        return res.data;
      }
      return [];
    },
    [getAccessToken]
  );

  // セッション切り替え時にステートをリセットして最新データを取得
  const prevSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevSessionIdRef.current === sessionId) return;
    prevSessionIdRef.current = sessionId;

    setHeadingSections([]);
    setHasAttemptedHeadingInit(false);
    setIsHeadingInitInFlight(false);
    setHeadingInitError(null);
    if (sessionId) {
      void fetchHeadingSections(sessionId);
    }
  }, [sessionId, fetchHeadingSections]);

  // Step 6 入場時の初期化
  useEffect(() => {
    if (
      !sessionId ||
      latestBlogStep !== 'step6' ||
      headingSections.length > 0 ||
      isHeadingInitInFlight ||
      hasAttemptedHeadingInit ||
      isSessionLoading ||
      headingInitError
    ) {
      return;
    }

    const initAndFetch = async () => {
      setIsHeadingInitInFlight(true);
      try {
        if (step5Content) {
          const liffAccessToken = await getAccessToken();
          const res = await headingActions.initializeHeadingSections({
            sessionId,
            step5Markdown: step5Content,
            liffAccessToken,
          });
          if (res.success) {
            await fetchHeadingSections(sessionId);
            setHeadingInitError(null);
            setHasAttemptedHeadingInit(true);
          } else {
            console.error('Failed to initialize heading sections:', res.error);
            setHeadingInitError(res.error || '初期化に失敗しました');
          }
        } else {
          // step5 メッセージがない場合は「試行済み」としてループを止める
          setHasAttemptedHeadingInit(true);
        }
      } catch (e) {
        console.error('Failed to initialize heading sections:', e);
        setHeadingInitError('予期せぬエラーが発生しました');
      } finally {
        if (sessionId === currentSessionIdRef.current) {
          setIsHeadingInitInFlight(false);
        }
      }
    };

    void initAndFetch();
  }, [
    sessionId,
    latestBlogStep,
    headingSections.length,
    isHeadingInitInFlight,
    step5Content,
    isSessionLoading,
    fetchHeadingSections,
    getAccessToken,
    hasAttemptedHeadingInit,
    headingInitError,
  ]);

  const handleSaveHeadingSection = useCallback(
    async (content: string) => {
      if (
        !sessionId ||
        activeHeadingIndex === undefined ||
        !activeHeading ||
        latestBlogStep !== 'step6' ||
        resolvedCanvasStep !== 'step6'
      ) {
        return;
      }

      setIsSavingHeading(true);
      try {
        const liffAccessToken = await getAccessToken();
        const res = await headingActions.saveHeadingSection({
          sessionId,
          headingKey: activeHeading.headingKey,
          content,
          liffAccessToken,
        });

        if (res.success) {
          const updatedSections = await fetchHeadingSections(sessionId);

          // 取得失敗時（空配列）は完了判定をスキップ
          if (updatedSections.length === 0) return;

          // 全ての見出しが完了したかチェック（返り値を使用してステール回避）
          const allDone = updatedSections.every(s => s.isConfirmed);

          if (allDone) {
            toast.success(
              '全見出しの保存が完了しました。全体の構成を確認して本文作成（Step 7）に進んでください。'
            );
          }
        } else {
          throw new Error(res.error || '保存に失敗しました');
        }
      } catch (e) {
        console.error('Failed to save heading section:', e);
        toast.error(e instanceof Error ? e.message : '保存に失敗しました');
      } finally {
        setIsSavingHeading(false);
      }
    },
    [
      sessionId,
      activeHeadingIndex,
      activeHeading,
      resolvedCanvasStep,
      fetchHeadingSections,
      getAccessToken,
      latestBlogStep,
    ]
  );

  const handleRetryHeadingInit = useCallback(() => {
    setHeadingInitError(null);
    setHasAttemptedHeadingInit(false);
  }, []);

  return {
    headingSections,
    isSavingHeading,
    isHeadingInitInFlight,
    hasAttemptedHeadingInit,
    headingInitError,
    activeHeadingIndex,
    activeHeading,
    fetchHeadingSections,
    handleSaveHeadingSection,
    handleRetryHeadingInit,
  };
}
