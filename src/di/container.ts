import { IChatService } from '@/domain/interfaces/IChatService';
import { ICanvasService } from '@/domain/interfaces/ICanvasService';
import { ISubscriptionService } from '@/domain/interfaces/ISubscriptionService';

import { ChatService } from '@/domain/services/ChatService';
import { CanvasService } from '@/domain/services/CanvasService';
import { SubscriptionService } from '@/domain/services/SubscriptionService';

// 開発環境判定
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// ロギング機能
interface Logger {
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, error?: unknown, context?: Record<string, unknown>) => void;
}

class ContainerLogger implements Logger {
  info(message: string, context?: Record<string, unknown>) {
    if (IS_DEVELOPMENT) {
      console.info(`[DI Container] ${message}`, context);
    }
  }

  warn(message: string, context?: Record<string, unknown>) {
    console.warn(`[DI Container] ${message}`, context);
  }

  error(message: string, error?: unknown, context?: Record<string, unknown>) {
    console.error(`[DI Container] ${message}`, error, context);
  }
}

const logger = new ContainerLogger();

// シングルトンインスタンスのキャッシュ
let chatServiceInstance: IChatService | null = null;
let canvasServiceInstance: ICanvasService | null = null;
let subscriptionServiceInstance: ISubscriptionService | null = null;

export const createChatService = (accessTokenProvider?: () => Promise<string>): IChatService => {
  try {
    if (!chatServiceInstance) {
      logger.info('Creating new ChatService instance');
      chatServiceInstance = new ChatService();
    }

    if (accessTokenProvider && chatServiceInstance instanceof ChatService) {
      logger.info('Setting access token provider for ChatService');
      chatServiceInstance.setAccessTokenProvider(accessTokenProvider);
    }

    return chatServiceInstance;
  } catch (error) {
    logger.error('Failed to create ChatService', error);
    throw new Error('ChatService の作成に失敗しました');
  }
};

export const createCanvasService = (): ICanvasService => {
  try {
    if (!canvasServiceInstance) {
      logger.info('Creating new CanvasService instance');
      canvasServiceInstance = new CanvasService();
    }
    return canvasServiceInstance;
  } catch (error) {
    logger.error('Failed to create CanvasService', error);
    throw new Error('CanvasService の作成に失敗しました');
  }
};

export const createSubscriptionService = (): ISubscriptionService => {
  try {
    if (!subscriptionServiceInstance) {
      logger.info('Creating new SubscriptionService instance');
      subscriptionServiceInstance = new SubscriptionService();
    }
    return subscriptionServiceInstance;
  } catch (error) {
    logger.error('Failed to create SubscriptionService', error);
    throw new Error('SubscriptionService の作成に失敗しました');
  }
};

// テスト用のリセット関数
export const resetContainer = () => {
  logger.warn('Resetting DI container - all service instances will be recreated');
  chatServiceInstance = null;
  canvasServiceInstance = null;
  subscriptionServiceInstance = null;
};

// ヘルスチェック機能
export const healthCheck = async (): Promise<Record<string, boolean>> => {
  const results: Record<string, boolean> = {};

  try {
    results.chatService = !!chatServiceInstance;
    results.canvasService = !!canvasServiceInstance;
    results.subscriptionService = !!subscriptionServiceInstance;

    logger.info('Health check completed', results);
    return results;
  } catch (error) {
    logger.error('Health check failed', error);
    return {};
  }
};

// 依存性の型定義（将来の拡張用）
export interface ServiceContainer {
  chatService: IChatService;
  canvasService: ICanvasService;
  subscriptionService: ISubscriptionService;
  logger: Logger;
}

export const createServiceContainer = (
  accessTokenProvider?: () => Promise<string>
): ServiceContainer => {
  try {
    logger.info('Creating service container', { hasAccessTokenProvider: !!accessTokenProvider });

    return {
      chatService: createChatService(accessTokenProvider),
      canvasService: createCanvasService(),
      subscriptionService: createSubscriptionService(),
      logger,
    };
  } catch (error) {
    logger.error('Failed to create service container', error);
    throw error;
  }
};

// 開発環境用のデバッグ情報
export const getContainerInfo = () => {
  if (!IS_DEVELOPMENT) return null;

  return {
    instances: {
      chatService: !!chatServiceInstance,
      canvasService: !!canvasServiceInstance,
      subscriptionService: !!subscriptionServiceInstance,
    },
    environment: process.env.NODE_ENV,
  };
};
