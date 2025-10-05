/**
 * キャンバス関連の型定義
 */

export interface CanvasSelectionEditPayload {
  instruction: string;
  selectedText: string;
  selectedHtml?: string;
  canvasMarkdown: string;
}

export interface CanvasSelectionEditResult {
  replacementHtml: string;
  explanation?: string;
}

export interface CanvasBubbleState {
  isVisible: boolean;
  message: string;
  type: 'markdown' | 'text' | 'download';
  position: { top: number; left: number };
}

export interface CanvasHeadingItem {
  level: number;
  text: string;
  id: string;
}

export interface CanvasSelectionState {
  from: number;
  to: number;
  text: string;
}
