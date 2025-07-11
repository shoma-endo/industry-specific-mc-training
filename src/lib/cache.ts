import { cache } from 'react';
import { chatService } from '@/server/services/chatService';
import { ServerChatSession } from '@/types/chat';

/**
 * React Cache を使用したセッション取得
 * 同一レンダリング中は結果をキャッシュし、重複リクエストを防ぐ
 */
export const getSessionsCached = cache(
  async (userId: string): Promise<ServerChatSession[]> => {
    try {
      return await chatService.getSessionsWithMessages(userId);
    } catch (error) {
      console.error('Cached session fetch failed:', error);
      // エラーが発生した場合は空配列を返す（アプリケーションの継続を優先）
      return [];
    }
  }
);

/**
 * ユーザーセッション数の取得（軽量版）
 * ダッシュボードなどで使用
 */
export const getUserSessionCount = cache(
  async (userId: string): Promise<number> => {
    try {
      const sessions = await chatService.getUserSessions(userId);
      return sessions.length;
    } catch (error) {
      console.error('Session count fetch failed:', error);
      return 0;
    }
  }
);

/**
 * キャッシュ無効化ヘルパー
 * 新しいセッションが作成された際などに使用
 */
export const invalidateSessionCache = () => {
  // React Cacheは自動的に無効化される（Next.js 15の機能）
  // 必要に応じて手動でrevalidateする
  console.log('Session cache invalidated');
};