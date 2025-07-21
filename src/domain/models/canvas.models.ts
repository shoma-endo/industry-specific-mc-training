import { CanvasData, CanvasToolState, CanvasTool } from '../interfaces/ICanvasService';

// 基本データ型
export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface DrawStyle {
  readonly color: string;
  readonly width: number;
  readonly opacity: number;
}

export interface DrawPath {
  readonly id: string;
  readonly tool: CanvasTool;
  readonly points: Point[];
  readonly style: DrawStyle;
  readonly timestamp: Date;
}

export interface Shape {
  readonly id: string;
  readonly type: 'rectangle' | 'circle' | 'line';
  readonly startPoint: Point;
  readonly endPoint: Point;
  readonly style: DrawStyle;
}

// Canvas状態管理
export interface CanvasState {
  readonly currentCanvas: CanvasData | null;
  readonly history: CanvasData[];
  readonly historyIndex: number;
  readonly tools: CanvasToolState;
  readonly isDrawing: boolean;
  readonly currentPath: DrawPath | null;
  readonly selectedShape: string | null;
}

// 初期状態とファクトリー関数
export const initialCanvasToolState: CanvasToolState = {
  selectedTool: 'pen',
  color: '#000000',
  brushSize: 3,
  backgroundColor: '#ffffff',
  opacity: 1.0,
};

export const createEmptyCanvas = (): CanvasData => ({
  id: `canvas_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  imageData: '',
  paths: [],
  shapes: [],
  tools: initialCanvasToolState,
  dimensions: { width: 400, height: 300 },
  timestamp: new Date(),
});

export const initialCanvasState: CanvasState = {
  currentCanvas: null,
  history: [],
  historyIndex: -1,
  tools: initialCanvasToolState,
  isDrawing: false,
  currentPath: null,
  selectedShape: null,
};

export const generateCanvasId = (): string => 
  `canvas_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const generatePathId = (): string =>
  `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const generateShapeId = (): string =>
  `shape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// ヘルパー関数
export const createDrawStyle = (
  color: string = '#000000',
  width: number = 3,
  opacity: number = 1.0
): DrawStyle => ({
  color,
  width,
  opacity,
});

export const createPoint = (x: number, y: number): Point => ({
  x: Math.round(x),
  y: Math.round(y),
});

export const createDrawPath = (
  tool: CanvasTool,
  startPoint: Point,
  style: DrawStyle
): DrawPath => ({
  id: generatePathId(),
  tool,
  points: [startPoint],
  style,
  timestamp: new Date(),
});

export const createShape = (
  type: 'rectangle' | 'circle' | 'line',
  startPoint: Point,
  endPoint: Point,
  style: DrawStyle
): Shape => ({
  id: generateShapeId(),
  type,
  startPoint,
  endPoint,
  style,
});

// バリデーション関数
export const isValidPoint = (point: Point): boolean => {
  return (
    typeof point.x === 'number' &&
    typeof point.y === 'number' &&
    !isNaN(point.x) &&
    !isNaN(point.y) &&
    isFinite(point.x) &&
    isFinite(point.y)
  );
};

export const isValidDrawStyle = (style: DrawStyle): boolean => {
  return (
    typeof style.color === 'string' &&
    style.color.length > 0 &&
    typeof style.width === 'number' &&
    style.width > 0 &&
    typeof style.opacity === 'number' &&
    style.opacity >= 0 &&
    style.opacity <= 1
  );
};