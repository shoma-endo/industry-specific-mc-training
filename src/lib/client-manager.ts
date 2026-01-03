import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/env';
import type { Database } from '@/types/database.types';

/**
 * SupabaseClientManager: Supabaseクライアントをシングルトンで管理
 * 接続プールの最適化により、同時接続数を削減してパフォーマンスを向上
 */
export class SupabaseClientManager {
  private static instance: SupabaseClientManager;
  private client: SupabaseClient<Database> | null = null;
  private serviceRoleClient: SupabaseClient<Database> | null = null;

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
   * 注意: クライアントサイドではANON_KEYを使用（SERVICE_ROLEは使用不可）
   */
  public getClient(): SupabaseClient<Database> {
    if (!this.client) {
      this.client = createClient<Database>(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY, // SERVICE_ROLEではなくANON_KEYを使用
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
              'X-Client-Info': 'supabase-js-client-optimized',
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
   * サービスロール権限のSupabaseクライアントを取得
   * 管理者機能でのみ使用（RLSをバイパス）
   * 注意: サーバーサイドでのみ使用可能
   */
  public getServiceRoleClient(): SupabaseClient<Database> {
    if (typeof window !== 'undefined') {
      throw new Error('Service role client cannot be used on the client side');
    }

    if (!this.serviceRoleClient) {
      this.serviceRoleClient = createClient<Database>(
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
              'X-Client-Info': 'supabase-js-service-role',
            },
          },
        }
      );
    }
    return this.serviceRoleClient;
  }

  /**
   * 接続をリセット（テスト用途やエラー復旧時に使用）
   */
  public resetConnection(): void {
    this.client = null;
    this.serviceRoleClient = null;
  }
}
