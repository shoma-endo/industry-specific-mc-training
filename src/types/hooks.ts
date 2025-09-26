/**
 * フック専用の型定義
 */
import type { SubscriptionStatus } from './user';
import type { SubscriptionStatus as DomainSubscriptionStatus } from '../domain/interfaces/ISubscriptionService';
import type { ChatState } from '../domain/models/chat.models';
import type { CanvasState, DrawStyle, Point, DrawMode, TextStyle, TextElement, ImageElement, ShapeElement, ShapeType, ShapeStyle } from './canvas';
import type { getLineProfileServerResponse } from '../server/handler/actions/login.actions';

/**
 * LIFF フック関連
 */
export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}


export interface UseLiffResult {
  isLoggedIn: boolean;
  isLoading: boolean;
  error: string | null;
  liffObject: unknown | null;
  profile: LiffProfile | null;
  login: () => void;
  logout: () => void;
  getLineProfile: () => Promise<getLineProfileServerResponse>;
  getAccessToken: () => Promise<string>;
  initLiff: () => Promise<void>;
  clearError: () => void;
}

/**
 * サブスクリプション フック関連
 */
export interface SubscriptionDetails {
  status: SubscriptionStatus;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  planName?: string;
  price?: number;
}

export interface SubscriptionHook {
  subscriptionStatus: DomainSubscriptionStatus | null;
  isLoading: boolean;
  requiresSubscription: boolean;
  hasActiveSubscription: boolean;
  subscriptionDetails: SubscriptionDetails | null;
  error: string | null;
  actions: {
    checkSubscription: () => Promise<void>;
    refreshSubscription: () => Promise<void>;
    clearError: () => void;
  };
}

/**
 * モバイル検出フック関連
 */
export interface UseMobileResult {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  orientation: 'portrait' | 'landscape';
}

/**
 * チャットセッション フック関連
 */
export interface ChatSessionActions {
  sendMessage: (content: string, model: string, options?: { systemPrompt?: string }) => Promise<void>;
  loadSessions: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  startNewSession: () => void;
}

export interface ChatSessionHook {
  state: ChatState;
  actions: ChatSessionActions;
}

/**
 * キャンバスパネル フック関連
 */
export interface CanvasPanelActions {
  updateCanvas: (updates: Partial<CanvasState>) => void;
  setCanvasSize: (width: number, height: number) => void;
  setBackgroundColor: (color: string) => void;
  setBackgroundImage: (url: string | null) => void;
  addTextElement: (x: number, y: number, text: string, style?: Partial<TextStyle>) => void;
  updateTextElement: (id: string, updates: Partial<TextElement>) => void;
  deleteTextElement: (id: string) => void;
  selectTextElement: (id: string | null) => void;
  addImageElement: (x: number, y: number, src: string, width?: number, height?: number) => void;
  updateImageElement: (id: string, updates: Partial<ImageElement>) => void;
  deleteImageElement: (id: string) => void;
  selectImageElement: (id: string | null) => void;
  addShapeElement: (x: number, y: number, shape: ShapeType, style?: Partial<ShapeStyle>) => void;
  updateShapeElement: (id: string, updates: Partial<ShapeElement>) => void;
  deleteShapeElement: (id: string) => void;
  selectShapeElement: (id: string | null) => void;
  setDrawMode: (mode: DrawMode) => void;
  setDrawStyle: (style: DrawStyle) => void;
  addDrawStroke: (points: Point[]) => void;
  updateDrawStroke: (id: string, points: Point[]) => void;
  deleteDrawStroke: (id: string) => void;
  clearDrawing: () => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  resetView: () => void;
  setGrid: (enabled: boolean, size?: number) => void;
  setSnapToGrid: (enabled: boolean) => void;
  toggleLayerVisibility: (id: string) => void;
  reorderLayer: (id: string, newIndex: number) => void;
  exportCanvas: (format: 'png' | 'jpg' | 'pdf') => Promise<Blob>;
  importCanvas: (data: CanvasState) => void;
  saveCanvas: () => Promise<void>;
  loadCanvas: (id: string) => Promise<void>;
  undo: () => void;
  redo: () => void;
  copyElement: (elementId: string) => void;
  pasteElement: (x: number, y: number) => void;
  groupElements: (elementIds: string[]) => void;
  ungroupElements: (groupId: string) => void;
}

export interface CanvasPanelHook {
  state: CanvasState;
  actions: CanvasPanelActions;
  error: string | null;
  clearError: () => void;
  createDrawStyle: (color?: string, width?: number, opacity?: number) => DrawStyle;
  createPoint: (x: number, y: number) => Point;
}
