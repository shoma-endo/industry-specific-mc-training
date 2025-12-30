import { useState, useCallback, useRef, useEffect } from 'react';

interface BubbleState {
  isVisible: boolean;
  message: string;
  position: { top: number; left: number };
}

/**
 * バブル通知の垂直方向オフセット（px）
 * コピーボタンの上にバブルを表示するための調整値
 */
const BUBBLE_VERTICAL_OFFSET = 52;

/**
 * バブル通知の水平方向オフセット（px）
 * コピーボタンの中央から左にずらすための調整値（バブルの幅の約半分を考慮した中央揃え）
 */
const BUBBLE_HORIZONTAL_OFFSET = 75;

interface UseCopyBubbleResult {
  bubble: BubbleState;
  copyButtonRef: React.RefObject<HTMLButtonElement | null>;
  showBubble: (message: string) => void;
}

export function useCopyBubble(): UseCopyBubbleResult {
  const [bubble, setBubble] = useState<BubbleState>({
    isVisible: false,
    message: '',
    position: { top: 0, left: 0 },
  });
  const copyButtonRef = useRef<HTMLButtonElement | null>(null);
  const bubbleTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // アンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      if (bubbleTimeoutRef.current) {
        clearTimeout(bubbleTimeoutRef.current);
      }
    };
  }, []);

  const showBubble = useCallback((message: string) => {
    if (!copyButtonRef.current) return;
    const rect = copyButtonRef.current.getBoundingClientRect();
    const containerRect =
      copyButtonRef.current.closest('[data-invite-dialog-container]')?.getBoundingClientRect() ||
      null;

    if (!containerRect) return;

    const relativeTop = rect.top - containerRect.top - BUBBLE_VERTICAL_OFFSET;
    const relativeLeft = rect.left - containerRect.left + rect.width / 2 - BUBBLE_HORIZONTAL_OFFSET;

    setBubble({
      isVisible: true,
      message,
      position: { top: relativeTop, left: relativeLeft },
    });

    // 前回のタイムアウトをクリア
    if (bubbleTimeoutRef.current) {
      clearTimeout(bubbleTimeoutRef.current);
    }

    bubbleTimeoutRef.current = setTimeout(() => {
      setBubble(prev => ({ ...prev, isVisible: false }));
    }, 3000);
  }, []);

  return {
    bubble,
    copyButtonRef,
    showBubble,
  };
}
