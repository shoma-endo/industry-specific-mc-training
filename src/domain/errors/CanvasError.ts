import { DomainError } from './BaseError';

export enum CanvasErrorCode {
  // 描画エラー
  DRAW_FAILED = 'CANVAS_DRAW_FAILED',
  INVALID_COORDINATES = 'CANVAS_INVALID_COORDINATES',
  
  // データエラー
  INVALID_DATA = 'CANVAS_INVALID_DATA',
  INVALID_IMAGE_FORMAT = 'CANVAS_INVALID_IMAGE_FORMAT',
  INVALID_DIMENSIONS = 'CANVAS_INVALID_DIMENSIONS',
  
  // 操作エラー
  PATH_NOT_FOUND = 'CANVAS_PATH_NOT_FOUND',
  SHAPE_NOT_FOUND = 'CANVAS_SHAPE_NOT_FOUND',
  
  // 保存/読み込みエラー
  SAVE_FAILED = 'CANVAS_SAVE_FAILED',
  LOAD_FAILED = 'CANVAS_LOAD_FAILED',
  EXPORT_FAILED = 'CANVAS_EXPORT_FAILED',
  
  // チャット連携エラー
  INSERT_TO_CHAT_FAILED = 'CANVAS_INSERT_TO_CHAT_FAILED',
  
  // 履歴エラー
  HISTORY_OPERATION_FAILED = 'CANVAS_HISTORY_FAILED',
}

export class CanvasError extends DomainError {
  constructor(
    message: string,
    code: CanvasErrorCode,
    context?: Record<string, unknown>
  ) {
    const userMessage = CanvasError.getUserMessage(code);
    super(message, code, userMessage, context);
  }

  private static getUserMessage(code: CanvasErrorCode): string {
    const messages: Record<CanvasErrorCode, string> = {
      [CanvasErrorCode.DRAW_FAILED]: '描画に失敗しました。再度お試しください。',
      [CanvasErrorCode.INVALID_COORDINATES]: '座標が正しくありません。',
      [CanvasErrorCode.INVALID_DATA]: 'Canvasデータが破損しています。',
      [CanvasErrorCode.INVALID_IMAGE_FORMAT]: '対応していない画像形式です。',
      [CanvasErrorCode.INVALID_DIMENSIONS]: 'Canvasのサイズが正しくありません。',
      [CanvasErrorCode.PATH_NOT_FOUND]: '描画パスが見つかりません。',
      [CanvasErrorCode.SHAPE_NOT_FOUND]: '図形が見つかりません。',
      [CanvasErrorCode.SAVE_FAILED]: 'Canvasの保存に失敗しました。',
      [CanvasErrorCode.LOAD_FAILED]: 'Canvasの読み込みに失敗しました。',
      [CanvasErrorCode.EXPORT_FAILED]: '画像の出力に失敗しました。',
      [CanvasErrorCode.INSERT_TO_CHAT_FAILED]: 'チャットへの挿入に失敗しました。',
      [CanvasErrorCode.HISTORY_OPERATION_FAILED]: '履歴操作に失敗しました。',
    };

    return messages[code] || '予期せぬエラーが発生しました。';
  }

  static fromApiError(error: unknown, context?: Record<string, unknown>): CanvasError {
    if (error instanceof CanvasError) {
      return error;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('canvas') || message.includes('draw')) {
        return new CanvasError(error.message, CanvasErrorCode.DRAW_FAILED, context);
      }
      
      if (message.includes('save') || message.includes('storage')) {
        return new CanvasError(error.message, CanvasErrorCode.SAVE_FAILED, context);
      }
      
      if (message.includes('export') || message.includes('image')) {
        return new CanvasError(error.message, CanvasErrorCode.EXPORT_FAILED, context);
      }
      
      return new CanvasError(error.message, CanvasErrorCode.DRAW_FAILED, context);
    }

    return new CanvasError(
      'Unknown canvas error occurred',
      CanvasErrorCode.DRAW_FAILED,
      { originalError: error, ...context }
    );
  }
}