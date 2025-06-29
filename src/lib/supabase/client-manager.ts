import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/env';

/**
 * SupabaseClientManager: Supabaseクライアントをシングルトンで管理
 * 接続プールの最適化により、同時接続数を削減してパフォーマンスを向上
 */
export class SupabaseClientManager {
  private static instance: SupabaseClientManager;
  private client: SupabaseClient | null = null;
  
  private constructor() {}
  
  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): SupabaseClientManager {
    if (!SupabaseClientManager.instance) {
      SupabaseClientManager.instance = new SupabaseClientManager();
    }
    return SupabaseClientManager.instance;
  }
  
  /**
   * 最適化されたSupabaseクライアントを取得
   * 接続プール設定とパフォーマンス最適化を含む
   */
  public getClient(): SupabaseClient {
    if (!this.client) {
      this.client = createClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
          db: {
            schema: 'public',
          },
          global: {
            headers: {
              'X-Client-Info': 'supabase-js-node-optimized',
            },
          },
          // 接続プール最適化設定
          realtime: {
            params: {
              eventsPerSecond: 10,
            },
          },
        }
      );
    }
    return this.client;
  }
  
  /**
   * 接続をリセット（テスト用途やエラー復旧時に使用）
   */
  public resetConnection(): void {
    this.client = null;
  }
}