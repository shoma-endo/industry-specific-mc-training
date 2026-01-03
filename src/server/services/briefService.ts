import { cache } from 'react';
import { SupabaseService } from '@/server/services/supabaseService';
import { parseTimestampOrNull } from '@/lib/timestamps';

export interface Brief {
  id: string;
  user_id: string;
  data: Record<string, string>;
  created_at: number | null;
  updated_at: number | null;
}

export class BriefService {
  private static readonly supabaseService = new SupabaseService();

  /**
   * ユーザーIDで事業者情報を取得
   */
  static async getByUserId(userId: string): Promise<Brief | null> {
    try {
      const client = this.supabaseService.getClient();
      const { data, error } = await client
        .from('briefs')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // レコードが見つからない場合（正常ケース）
          if (process.env.NODE_ENV === 'development') {
            console.log(`事業者情報が未登録: userId=${userId}`);
          }
          return null;
        }
        console.error('Brief取得エラー:', error);
        return null;
      }

      return {
        ...data,
        created_at: parseTimestampOrNull(data.created_at),
        updated_at: parseTimestampOrNull(data.updated_at),
      };
    } catch (error) {
      console.error('Brief取得例外:', error);
      return null;
    }
  }

  /**
   * React Cacheでキャッシュ化された取得関数
   * 同一リクエスト中は1回のみDB参照
   */
  static getCachedByUserId = cache(async (userId: string): Promise<Brief | null> => {
    return this.getByUserId(userId);
  });

  /**
   * 事業者情報のデータ部分のみを取得
   * テンプレート変数置換用
   */
  static async getVariablesByUserId(userId: string): Promise<Record<string, string>> {
    const brief = await this.getCachedByUserId(userId);
    return brief?.data ?? {};
  }

  /**
   * キャッシュクリア（更新時に呼び出し）
   */
  static clearCache(userId: string): void {
    // React CacheはAPIレベルでのclear機能が限定的なため
    // 実装上は次回リクエスト時に自然に更新される
    if (process.env.NODE_ENV === 'development') {
      console.log(`Brief cache cleared for userId: ${userId}`);
    }
  }

  /**
   * 全てのキャッシュをクリア
   */
  static invalidateAllCaches(): void {
    if (process.env.NODE_ENV === 'development') {
      console.log('Brief cache invalidated (all)');
    }
    // React Cacheの制限により、実際のクリアは次回リクエスト時
  }
}
