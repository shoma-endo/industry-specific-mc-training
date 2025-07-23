import { Point, DrawPath, Shape, DrawStyle } from '@/domain/models/canvas.models';

export type CanvasTool = 'pen' | 'eraser' | 'rect' | 'circle' | 'text' | 'select';

export interface CanvasToolState {
  readonly selectedTool: CanvasTool;
  readonly color: string;
  readonly brushSize: number;
  readonly backgroundColor: string;
  readonly opacity: number;
}

export interface CanvasData {
  readonly id: string;
  readonly imageData: string;
  readonly paths: DrawPath[];
  readonly shapes: Shape[];
  readonly tools: CanvasToolState;
  readonly dimensions: { width: number; height: number };
  readonly timestamp: Date;
}

export interface ICanvasService {
  // 基本操作
  saveCanvas(canvasData: CanvasData): Promise<string>;
  insertToChat(imageData: string, sessionId: string): Promise<void>;
  loadCanvasHistory(sessionId: string): Promise<CanvasData[]>;
  clearCanvas(): void;
  
  // 描画操作
  startDrawing(point: Point, tool: CanvasTool, style: DrawStyle): string;
  addPointToPath(pathId: string, point: Point): void;
  endDrawing(pathId: string): void;
  
  // 図形操作
  createShape(type: 'rectangle' | 'circle' | 'line', start: Point, end: Point, style: DrawStyle): Shape;
  updateShape(shapeId: string, end: Point): void;
  deleteShape(shapeId: string): void;
  
  // 履歴操作
  undo(): CanvasData | null;
  redo(): CanvasData | null;
  addToHistory(canvasData: CanvasData): void;
  
  // ユーティリティ
  exportAsImage(format: 'png' | 'jpg' | 'svg'): Promise<string>;
  importFromImage(imageData: string): Promise<CanvasData>;
  
  // 状態取得
  getCurrentCanvas(): CanvasData | null;
  getCanvasById(canvasId: string): CanvasData | undefined;
  
  // イベント管理
  onCanvasChanged(callback: (canvas: CanvasData) => void): void;
  offCanvasChanged(callback: (canvas: CanvasData) => void): void;
}