import { ICanvasService, CanvasData, CanvasTool } from '../interfaces/ICanvasService';
import { 
  Point, 
  DrawPath, 
  Shape, 
  DrawStyle, 
  createEmptyCanvas, 
  generatePathId,
  isValidPoint,
  isValidDrawStyle,
  createDrawPath,
  createShape as createShapeModel
} from '../models/canvas.models';
import { CanvasError, CanvasErrorCode } from '../errors/CanvasError';

export class CanvasService implements ICanvasService {
  private currentCanvas: CanvasData = createEmptyCanvas();
  private history: CanvasData[] = [];
  private historyIndex: number = -1;
  private activePaths: Map<string, DrawPath> = new Map();
  private activeShapes: Map<string, Shape> = new Map();
  private changeCallbacks: ((canvas: CanvasData) => void)[] = [];

  // 基本操作
  async saveCanvas(canvasData: CanvasData): Promise<string> {
    try {
      this.validateCanvasData(canvasData);
      
      const savedUrl = await this.uploadToStorage(canvasData.imageData, canvasData.id);
      
      this.addToHistory(canvasData);
      this.notifyChange(canvasData);
      
      return savedUrl;
    } catch (error) {
      throw new CanvasError(
        'Canvas保存に失敗しました',
        CanvasErrorCode.SAVE_FAILED,
        { canvasId: canvasData.id, error }
      );
    }
  }

  async insertToChat(imageData: string, sessionId: string): Promise<void> {
    try {
      this.validateImageData(imageData);
      
      this.emitCanvasInserted(imageData, sessionId);
      this.clearCanvas();
    } catch (error) {
      throw new CanvasError(
        'チャットへの挿入に失敗しました',
        CanvasErrorCode.INSERT_TO_CHAT_FAILED,
        { sessionId, error }
      );
    }
  }

  async loadCanvasHistory(sessionId: string): Promise<CanvasData[]> {
    try {
      // セッションIDベースのデータベース検索は未実装
      // 現在は過去24時間の履歴をフィルタリング
      return this.history.filter(canvas => 
        canvas.timestamp && canvas.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
      );
    } catch (error) {
      throw new CanvasError(
        'Canvas履歴の読み込みに失敗しました',
        CanvasErrorCode.LOAD_FAILED,
        { sessionId, error }
      );
    }
  }

  clearCanvas(): void {
    this.currentCanvas = createEmptyCanvas();
    this.activePaths.clear();
    this.activeShapes.clear();
    this.notifyChange(this.currentCanvas);
  }

  // 描画操作
  startDrawing(point: Point, tool: CanvasTool, style: DrawStyle): string {
    if (!isValidPoint(point)) {
      throw new CanvasError(
        'Invalid point coordinates',
        CanvasErrorCode.INVALID_COORDINATES,
        { point }
      );
    }

    if (!isValidDrawStyle(style)) {
      throw new CanvasError(
        'Invalid draw style',
        CanvasErrorCode.INVALID_DATA,
        { style }
      );
    }

    const pathId = generatePathId();
    const newPath = createDrawPath(tool, point, style);
    
    this.activePaths.set(pathId, newPath);
    return pathId;
  }

  addPointToPath(pathId: string, point: Point): void {
    if (!isValidPoint(point)) {
      throw new CanvasError(
        'Invalid point coordinates',
        CanvasErrorCode.INVALID_COORDINATES,
        { pathId, point }
      );
    }

    const path = this.activePaths.get(pathId);
    if (!path) {
      throw new CanvasError(
        'アクティブなパスが見つかりません',
        CanvasErrorCode.PATH_NOT_FOUND,
        { pathId }
      );
    }

    const updatedPath: DrawPath = {
      ...path,
      points: [...path.points, point],
    };
    
    this.activePaths.set(pathId, updatedPath);
  }

  endDrawing(pathId: string): void {
    const path = this.activePaths.get(pathId);
    if (!path) {
      console.warn(`Path ${pathId} not found when ending drawing`);
      return;
    }

    this.currentCanvas = {
      ...this.currentCanvas,
      paths: [...this.currentCanvas.paths, path],
      timestamp: new Date(),
    };

    this.activePaths.delete(pathId);
    this.addToHistory(this.currentCanvas);
    this.notifyChange(this.currentCanvas);
  }

  // 図形操作
  createShape(type: 'rectangle' | 'circle' | 'line', start: Point, end: Point, style: DrawStyle): Shape {
    if (!isValidPoint(start) || !isValidPoint(end)) {
      throw new CanvasError(
        'Invalid shape coordinates',
        CanvasErrorCode.INVALID_COORDINATES,
        { start, end }
      );
    }

    if (!isValidDrawStyle(style)) {
      throw new CanvasError(
        'Invalid draw style',
        CanvasErrorCode.INVALID_DATA,
        { style }
      );
    }

    const shape = createShapeModel(type, start, end, style);
    
    this.currentCanvas = {
      ...this.currentCanvas,
      shapes: [...this.currentCanvas.shapes, shape],
      timestamp: new Date(),
    };

    this.addToHistory(this.currentCanvas);
    this.notifyChange(this.currentCanvas);
    
    return shape;
  }

  updateShape(shapeId: string, end: Point): void {
    if (!isValidPoint(end)) {
      throw new CanvasError(
        'Invalid end point coordinates',
        CanvasErrorCode.INVALID_COORDINATES,
        { shapeId, end }
      );
    }

    const shapeIndex = this.currentCanvas.shapes.findIndex(s => s.id === shapeId);
    if (shapeIndex === -1) {
      throw new CanvasError(
        '図形が見つかりません',
        CanvasErrorCode.SHAPE_NOT_FOUND,
        { shapeId }
      );
    }

    const updatedShapes = [...this.currentCanvas.shapes];
    updatedShapes[shapeIndex] = {
      ...updatedShapes[shapeIndex]!,
      endPoint: end,
    };

    this.currentCanvas = {
      ...this.currentCanvas,
      shapes: updatedShapes,
      timestamp: new Date(),
    };

    this.notifyChange(this.currentCanvas);
  }

  deleteShape(shapeId: string): void {
    const shapeExists = this.currentCanvas.shapes.some(s => s.id === shapeId);
    if (!shapeExists) {
      throw new CanvasError(
        '図形が見つかりません',
        CanvasErrorCode.SHAPE_NOT_FOUND,
        { shapeId }
      );
    }

    this.currentCanvas = {
      ...this.currentCanvas,
      shapes: this.currentCanvas.shapes.filter(s => s.id !== shapeId),
      timestamp: new Date(),
    };

    this.addToHistory(this.currentCanvas);
    this.notifyChange(this.currentCanvas);
  }

  // 履歴操作
  undo(): CanvasData | null {
    try {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.currentCanvas = this.history[this.historyIndex]!;
        this.notifyChange(this.currentCanvas);
        return this.currentCanvas;
      }
      return null;
    } catch (error) {
      throw new CanvasError(
        'Undo操作に失敗しました',
        CanvasErrorCode.HISTORY_OPERATION_FAILED,
        { historyIndex: this.historyIndex, error }
      );
    }
  }

  redo(): CanvasData | null {
    try {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        this.currentCanvas = this.history[this.historyIndex]!;
        this.notifyChange(this.currentCanvas);
        return this.currentCanvas;
      }
      return null;
    } catch (error) {
      throw new CanvasError(
        'Redo操作に失敗しました',
        CanvasErrorCode.HISTORY_OPERATION_FAILED,
        { historyIndex: this.historyIndex, error }
      );
    }
  }

  addToHistory(canvasData: CanvasData): void {
    // 現在の位置以降の履歴を削除
    this.history = this.history.slice(0, this.historyIndex + 1);
    
    // 新しい状態を追加
    this.history.push({ ...canvasData });
    this.historyIndex = this.history.length - 1;
    
    // 履歴の上限を設定（メモリ管理）
    const MAX_HISTORY = 50;
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY);
      this.historyIndex = this.history.length - 1;
    }
  }

  // ユーティリティ
  async exportAsImage(format: 'png' | 'jpg' | 'svg'): Promise<string> {
    try {
      const canvas = this.renderToCanvas();
      const dataUrl = canvas.toDataURL(`image/${format}`);
      return dataUrl;
    } catch (error) {
      throw new CanvasError(
        '画像エクスポートに失敗しました',
        CanvasErrorCode.EXPORT_FAILED,
        { format, error }
      );
    }
  }

  async importFromImage(imageData: string): Promise<CanvasData> {
    try {
      this.validateImageData(imageData);
      
      const newCanvas: CanvasData = {
        ...createEmptyCanvas(),
        imageData,
        timestamp: new Date(),
      };

      this.currentCanvas = newCanvas;
      this.addToHistory(newCanvas);
      this.notifyChange(newCanvas);
      
      return newCanvas;
    } catch (error) {
      throw new CanvasError(
        '画像インポートに失敗しました',
        CanvasErrorCode.LOAD_FAILED,
        { error }
      );
    }
  }

  // 状態取得
  getCurrentCanvas(): CanvasData | null {
    return this.currentCanvas;
  }

  getCanvasById(canvasId: string): CanvasData | undefined {
    return this.history.find(canvas => canvas.id === canvasId);
  }

  // イベント管理
  onCanvasChanged(callback: (canvas: CanvasData) => void): void {
    this.changeCallbacks.push(callback);
  }

  offCanvasChanged(callback: (canvas: CanvasData) => void): void {
    const index = this.changeCallbacks.indexOf(callback);
    if (index > -1) {
      this.changeCallbacks.splice(index, 1);
    }
  }

  // プライベートメソッド
  private validateCanvasData(canvasData: CanvasData): void {
    if (!canvasData.id) {
      throw new CanvasError('Canvas IDが無効です', CanvasErrorCode.INVALID_DATA);
    }
    
    if (canvasData.dimensions.width <= 0 || canvasData.dimensions.height <= 0) {
      throw new CanvasError('Canvas寸法が無効です', CanvasErrorCode.INVALID_DIMENSIONS);
    }
  }

  private validateImageData(imageData: string): void {
    if (!imageData || !imageData.startsWith('data:image/')) {
      throw new CanvasError('無効な画像データ形式です', CanvasErrorCode.INVALID_IMAGE_FORMAT);
    }
  }

  private async uploadToStorage(imageData: string, canvasId: string): Promise<string> {
    // Supabase Storageへのアップロードは未実装
    return `https://supabase.storage/${canvasId}.png`;
  }

  private emitCanvasInserted(imageData: string, sessionId: string): void {
    // イベントバスシステムは未実装
    console.log('Canvas inserted to chat:', { sessionId, imageSize: imageData.length });
  }

  private notifyChange(canvas: CanvasData): void {
    this.changeCallbacks.forEach(callback => {
      try {
        callback(canvas);
      } catch (error) {
        console.error('Error in canvas change callback:', error);
      }
    });
  }

  private renderToCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.currentCanvas.dimensions.width;
    canvas.height = this.currentCanvas.dimensions.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');
    
    // 背景を設定
    ctx.fillStyle = this.currentCanvas.tools.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // パスと図形を描画
    this.drawPaths(ctx, this.currentCanvas.paths);
    this.drawShapes(ctx, this.currentCanvas.shapes);
    
    return canvas;
  }

  private drawPaths(ctx: CanvasRenderingContext2D, paths: DrawPath[]): void {
    paths.forEach(path => {
      if (path.points.length < 2) return;
      
      ctx.strokeStyle = path.style.color;
      ctx.lineWidth = path.style.width;
      ctx.globalAlpha = path.style.opacity;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      ctx.moveTo(path.points[0]!.x, path.points[0]!.y);
      
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i]!.x, path.points[i]!.y);
      }
      
      ctx.stroke();
    });
  }

  private drawShapes(ctx: CanvasRenderingContext2D, shapes: Shape[]): void {
    shapes.forEach(shape => {
      ctx.strokeStyle = shape.style.color;
      ctx.lineWidth = shape.style.width;
      ctx.globalAlpha = shape.style.opacity;
      
      const { startPoint, endPoint } = shape;
      
      switch (shape.type) {
        case 'rectangle':
          const width = endPoint.x - startPoint.x;
          const height = endPoint.y - startPoint.y;
          ctx.strokeRect(startPoint.x, startPoint.y, width, height);
          break;
          
        case 'circle':
          const radius = Math.sqrt(
            Math.pow(endPoint.x - startPoint.x, 2) + 
            Math.pow(endPoint.y - startPoint.y, 2)
          );
          ctx.beginPath();
          ctx.arc(startPoint.x, startPoint.y, radius, 0, 2 * Math.PI);
          ctx.stroke();
          break;
          
        case 'line':
          ctx.beginPath();
          ctx.moveTo(startPoint.x, startPoint.y);
          ctx.lineTo(endPoint.x, endPoint.y);
          ctx.stroke();
          break;
      }
    });
  }
}