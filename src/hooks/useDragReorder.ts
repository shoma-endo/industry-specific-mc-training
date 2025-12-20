'use client';

import * as React from 'react';

interface UseDragReorderOptions<T> {
  /** 並び替え対象のアイテム配列 */
  items: T[];
  /** アイテムからIDを取得する関数 */
  getId: (item: T) => string;
  /** 並び替え完了時のコールバック */
  onReorder: (newItems: T[]) => void;
}

interface UseDragReorderReturn {
  /** 現在ドラッグ中のアイテムID（null = ドラッグしていない） */
  draggedId: string | null;
  /** ドラッグ開始時のハンドラー */
  handleDragStart: (e: React.DragEvent, id: string) => void;
  /** ドラッグ中（ホバー時）のハンドラー */
  handleDragOver: (e: React.DragEvent) => void;
  /** ドロップ時のハンドラー */
  handleDrop: (e: React.DragEvent, targetId: string) => void;
  /** ドラッグ終了時のハンドラー */
  handleDragEnd: () => void;
  /** ドラッグ中かどうかを判定するヘルパー */
  isDragging: (id: string) => boolean;
}

/**
 * ドラッグ＆ドロップによる並び替え機能を提供するカスタムフック
 *
 * @example
 * ```tsx
 * const { draggedId, handleDragStart, handleDragOver, handleDrop, handleDragEnd, isDragging } =
 *   useDragReorder({
 *     items: categories,
 *     getId: (item) => item.id,
 *     onReorder: (newItems) => setCategories(newItems),
 *   });
 *
 * return (
 *   <div
 *     draggable
 *     onDragStart={(e) => handleDragStart(e, item.id)}
 *     onDragOver={handleDragOver}
 *     onDrop={(e) => handleDrop(e, item.id)}
 *     onDragEnd={handleDragEnd}
 *     className={isDragging(item.id) ? 'opacity-50' : ''}
 *   >
 *     {item.name}
 *   </div>
 * );
 * ```
 */
export function useDragReorder<T>({
  items,
  getId,
  onReorder,
}: UseDragReorderOptions<T>): UseDragReorderReturn {
  const [draggedId, setDraggedId] = React.useState<string | null>(null);

  const handleDragStart = React.useCallback((e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = React.useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();

      if (!draggedId || draggedId === targetId) {
        setDraggedId(null);
        return;
      }

      const draggedIndex = items.findIndex(item => getId(item) === draggedId);
      const targetIndex = items.findIndex(item => getId(item) === targetId);

      if (draggedIndex === -1 || targetIndex === -1) {
        setDraggedId(null);
        return;
      }

      const newItems = [...items];
      const [removed] = newItems.splice(draggedIndex, 1);
      if (removed) {
        newItems.splice(targetIndex, 0, removed);
      }

      setDraggedId(null);
      onReorder(newItems);
    },
    [draggedId, items, getId, onReorder]
  );

  const handleDragEnd = React.useCallback(() => {
    setDraggedId(null);
  }, []);

  const isDragging = React.useCallback(
    (id: string) => draggedId === id,
    [draggedId]
  );

  return {
    draggedId,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    isDragging,
  };
}
