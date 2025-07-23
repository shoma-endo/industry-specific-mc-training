'use client';

import { useState, useCallback, useEffect } from 'react';
import { ICanvasService, CanvasData } from '@/domain/interfaces/ICanvasService';
import { 
  CanvasState, 
  initialCanvasState, 
  createEmptyCanvas, 
  Point, 
  DrawStyle,
  createDrawStyle,
  createPoint 
} from '@/domain/models/canvas.models';
import { CanvasError } from '@/domain/errors/CanvasError';
import { CanvasTool } from '@/domain/interfaces/ICanvasService';

export interface CanvasPanelActions {
  // 基本操作
  saveCanvas: (imageData: string) => Promise<string>;
  insertToChat: (imageData: string, sessionId: string) => Promise<void>;
  clearCanvas: () => void;
  loadCanvasHistory: (sessionId: string) => Promise<void>;
  
  // ツール操作
  updateTools: (tools: Partial<CanvasState['tools']>) => void;
  setDrawing: (isDrawing: boolean) => void;
  
  // 描画操作
  startDrawing: (point: Point, tool: string, style: DrawStyle) => string;
  addPointToPath: (pathId: string, point: Point) => void;
  endDrawing: (pathId: string) => void;
  
  // 図形操作
  createShape: (type: 'rectangle' | 'circle' | 'line', start: Point, end: Point, style: DrawStyle) => void;
  updateShape: (shapeId: string, end: Point) => void;
  deleteShape: (shapeId: string) => void;
  
  // 履歴操作
  undo: () => void;
  redo: () => void;
  
  // ユーティリティ
  exportAsImage: (format: 'png' | 'jpg' | 'svg') => Promise<string>;
  importFromImage: (imageData: string) => Promise<void>;
}

export interface CanvasPanelHook {
  state: CanvasState;
  actions: CanvasPanelActions;
  error: string | null;
  clearError: () => void;
  createDrawStyle: (color?: string, width?: number, opacity?: number) => DrawStyle;
  createPoint: (x: number, y: number) => Point;
}

export const useCanvasPanel = (canvasService: ICanvasService): CanvasPanelHook => {
  const [state, setState] = useState<CanvasState>(initialCanvasState);
  const [error, setError] = useState<string | null>(null);

  // Canvas変更イベントの監視
  useEffect(() => {
    const handleCanvasChanged = (canvas: CanvasData) => {
      setState(prev => ({
        ...prev,
        currentCanvas: canvas,
      }));
    };

    canvasService.onCanvasChanged(handleCanvasChanged);

    return () => {
      canvasService.offCanvasChanged(handleCanvasChanged);
    };
  }, [canvasService]);

  // エラーハンドリングヘルパー
  const handleError = useCallback((error: unknown) => {
    if (error instanceof CanvasError) {
      setError(error.userMessage);
    } else if (error instanceof Error) {
      setError(error.message);
    } else {
      setError('予期せぬエラーが発生しました');
    }
    console.error('Canvas error:', error);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 基本操作
  const saveCanvas = useCallback(async (imageData: string): Promise<string> => {
    try {
      setError(null);
      const canvasData = {
        ...createEmptyCanvas(),
        imageData,
        tools: state.tools,
      };

      const savedUrl = await canvasService.saveCanvas(canvasData);
      
      setState(prev => ({
        ...prev,
        currentCanvas: canvasData,
      }));

      return savedUrl;
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [canvasService, state.tools, handleError]);

  const insertToChat = useCallback(async (imageData: string, sessionId: string) => {
    try {
      setError(null);
      await canvasService.insertToChat(imageData, sessionId);
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [canvasService, handleError]);

  const clearCanvas = useCallback(() => {
    try {
      setError(null);
      canvasService.clearCanvas();
    } catch (error) {
      handleError(error);
    }
  }, [canvasService, handleError]);

  const loadCanvasHistory = useCallback(async (sessionId: string) => {
    try {
      setError(null);
      const history = await canvasService.loadCanvasHistory(sessionId);
      setState(prev => ({
        ...prev,
        history,
        historyIndex: history.length - 1,
      }));
    } catch (error) {
      handleError(error);
    }
  }, [canvasService, handleError]);

  // ツール操作
  const updateTools = useCallback((toolUpdates: Partial<CanvasState['tools']>) => {
    setState(prev => ({
      ...prev,
      tools: { ...prev.tools, ...toolUpdates },
    }));
  }, []);

  const setDrawing = useCallback((isDrawing: boolean) => {
    setState(prev => ({
      ...prev,
      isDrawing,
    }));
  }, []);

  // 描画操作
  const startDrawing = useCallback((point: Point, tool: string, style: DrawStyle): string => {
    try {
      setError(null);
      const pathId = canvasService.startDrawing(point, tool as CanvasTool, style);
      
      setState(prev => ({
        ...prev,
        isDrawing: true,
        currentPath: {
          id: pathId,
          tool: tool as CanvasTool,
          points: [point],
          style,
          timestamp: new Date(),
        },
      }));

      return pathId;
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [canvasService, handleError]);

  const addPointToPath = useCallback((pathId: string, point: Point) => {
    try {
      setError(null);
      canvasService.addPointToPath(pathId, point);
      
      setState(prev => ({
        ...prev,
        currentPath: prev.currentPath ? {
          ...prev.currentPath,
          points: [...prev.currentPath.points, point],
        } : null,
      }));
    } catch (error) {
      handleError(error);
    }
  }, [canvasService, handleError]);

  const endDrawing = useCallback((pathId: string) => {
    try {
      setError(null);
      canvasService.endDrawing(pathId);
      
      setState(prev => ({
        ...prev,
        isDrawing: false,
        currentPath: null,
      }));
    } catch (error) {
      handleError(error);
    }
  }, [canvasService, handleError]);

  // 図形操作
  const createShape = useCallback((
    type: 'rectangle' | 'circle' | 'line', 
    start: Point, 
    end: Point, 
    style: DrawStyle
  ) => {
    try {
      setError(null);
      canvasService.createShape(type, start, end, style);
    } catch (error) {
      handleError(error);
    }
  }, [canvasService, handleError]);

  const updateShape = useCallback((shapeId: string, end: Point) => {
    try {
      setError(null);
      canvasService.updateShape(shapeId, end);
    } catch (error) {
      handleError(error);
    }
  }, [canvasService, handleError]);

  const deleteShape = useCallback((shapeId: string) => {
    try {
      setError(null);
      canvasService.deleteShape(shapeId);
    } catch (error) {
      handleError(error);
    }
  }, [canvasService, handleError]);

  // 履歴操作
  const undo = useCallback(() => {
    try {
      setError(null);
      const canvas = canvasService.undo();
      if (canvas) {
        setState(prev => ({
          ...prev,
          currentCanvas: canvas,
          historyIndex: Math.max(0, prev.historyIndex - 1),
        }));
      }
    } catch (error) {
      handleError(error);
    }
  }, [canvasService, handleError]);

  const redo = useCallback(() => {
    try {
      setError(null);
      const canvas = canvasService.redo();
      if (canvas) {
        setState(prev => ({
          ...prev,
          currentCanvas: canvas,
          historyIndex: Math.min(prev.history.length - 1, prev.historyIndex + 1),
        }));
      }
    } catch (error) {
      handleError(error);
    }
  }, [canvasService, handleError]);

  // ユーティリティ
  const exportAsImage = useCallback(async (format: 'png' | 'jpg' | 'svg'): Promise<string> => {
    try {
      setError(null);
      return await canvasService.exportAsImage(format);
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [canvasService, handleError]);

  const importFromImage = useCallback(async (imageData: string) => {
    try {
      setError(null);
      const canvas = await canvasService.importFromImage(imageData);
      setState(prev => ({
        ...prev,
        currentCanvas: canvas,
      }));
    } catch (error) {
      handleError(error);
    }
  }, [canvasService, handleError]);

  // ヘルパー関数をエクスポート
  const createDrawStyleHelper = useCallback((
    color?: string,
    width?: number,
    opacity?: number
  ): DrawStyle => {
    return createDrawStyle(
      color || state.tools.color,
      width || state.tools.brushSize,
      opacity || state.tools.opacity
    );
  }, [state.tools]);

  const createPointHelper = useCallback((x: number, y: number): Point => {
    return createPoint(x, y);
  }, []);

  return {
    state,
    actions: {
      saveCanvas,
      insertToChat,
      clearCanvas,
      loadCanvasHistory,
      updateTools,
      setDrawing,
      startDrawing,
      addPointToPath,
      endDrawing,
      createShape,
      updateShape,
      deleteShape,
      undo,
      redo,
      exportAsImage,
      importFromImage,
    },
    error,
    clearError,
    // ヘルパー関数も含める
    createDrawStyle: createDrawStyleHelper,
    createPoint: createPointHelper,
  };
};