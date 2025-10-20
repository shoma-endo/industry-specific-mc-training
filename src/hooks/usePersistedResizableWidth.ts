import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

interface Options {
  storageKey?: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
}

interface UsePersistedResizableWidthResult {
  width: number;
  isResizing: boolean;
  handleMouseDown: (event: ReactMouseEvent) => void;
}

export function usePersistedResizableWidth({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
}: Options): UsePersistedResizableWidthResult {
  const key = storageKey ?? 'resizable-panel-width';
  const bounds = useMemo(
    () => ({
      min: minWidth,
      max: maxWidth,
    }),
    [minWidth, maxWidth]
  );

  const [width, setWidth] = useState(() => {
    if (typeof window === 'undefined') return defaultWidth;
    const saved = window.localStorage.getItem(key);
    if (!saved) return defaultWidth;
    const parsed = parseInt(saved, 10);
    return Number.isFinite(parsed) ? parsed : defaultWidth;
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartXRef = useRef(0);
  const initialWidthRef = useRef(width);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, width.toString());
  }, [key, width]);

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent) => {
      setIsResizing(true);
      resizeStartXRef.current = event.clientX;
      initialWidthRef.current = width;
      event.preventDefault();
    },
    [width]
  );

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isResizing) return;
      const deltaX = resizeStartXRef.current - event.clientX;
      const nextWidth = Math.max(bounds.min, Math.min(bounds.max, initialWidthRef.current + deltaX));
      setWidth(nextWidth);
    },
    [bounds.max, bounds.min, isResizing]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const stopResizing = () => handleMouseUp();

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [handleMouseMove, handleMouseUp, isResizing]);

  return {
    width,
    isResizing,
    handleMouseDown,
  };
}
