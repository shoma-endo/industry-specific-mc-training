/**
 * キャンバス関連の型定義
 */

/**
 * 基本的な図形タイプ
 */
export type ShapeType = 'rectangle' | 'circle' | 'line' | 'arrow' | 'triangle';

/**
 * 描画モード
 */
export type DrawMode = 'select' | 'text' | 'image' | 'shape' | 'draw' | 'pan';

/**
 * 座標点
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * 描画スタイル
 */
export interface DrawStyle {
  color: string;
  width: number;
  opacity: number;
}

/**
 * テキストスタイル
 */
export interface TextStyle {
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: 'left' | 'center' | 'right';
}

/**
 * 図形スタイル
 */
export interface ShapeStyle {
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
}

/**
 * キャンバス要素の基底インターフェース
 */
export interface BaseCanvasElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  visible: boolean;
}

/**
 * テキスト要素
 */
export interface TextElement extends BaseCanvasElement {
  type: 'text';
  content: string;
  style: TextStyle;
}

/**
 * 画像要素
 */
export interface ImageElement extends BaseCanvasElement {
  type: 'image';
  src: string;
  originalWidth: number;
  originalHeight: number;
}

/**
 * 図形要素
 */
export interface ShapeElement extends BaseCanvasElement {
  type: 'shape';
  shapeType: ShapeType;
  style: ShapeStyle;
}

/**
 * 描画ストローク
 */
export interface DrawStroke {
  id: string;
  points: Point[];
  style: DrawStyle;
}

/**
 * レイヤー情報
 */
export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
}

/**
 * キャンバス要素の統合型
 */
export type CanvasElement = TextElement | ImageElement | ShapeElement;

/**
 * キャンバスの状態
 */
export interface CanvasState {
  width: number;
  height: number;
  backgroundColor: string;
  backgroundImage: string | null;
  elements: CanvasElement[];
  drawStrokes: DrawStroke[];
  selectedElementId: string | null;
  drawMode: DrawMode;
  drawStyle: DrawStyle;
  zoom: number;
  panX: number;
  panY: number;
  gridEnabled: boolean;
  gridSize: number;
  snapToGrid: boolean;
  layers: Layer[];
  history: CanvasState[];
  historyIndex: number;
  clipboard: CanvasElement | null;
}