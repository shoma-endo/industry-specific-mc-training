import { createClient } from '@supabase/supabase-js';
import { env } from '@/env';
import { cache } from 'react';

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE
);

export interface Brief {
  id: string;
  user_id: string;
  data: Record<string, string>;
  created_at: number;
  updated_at: number;
}

export class BriefService {
  /**
   * ユーザーIDで事業者情報を取得
   */
  static async getByUserId(userId: string): Promise<Brief | null> {
    try {
      const { data, error } = await supabase
        .from('briefs')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // レコードが見つからない場合（正常ケース）
          console.log(`事業者情報が未登録: userId=${userId}`);
          return null;
        }
        console.error('Brief取得エラー:', error);
        return null;
      }

      return data as Brief;
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
    console.log(`Brief cache cleared for userId: ${userId}`);
  }

  /**
   * 全てのキャッシュをクリア
   */
  static invalidateAllCaches(): void {
    console.log('Brief cache invalidated (all)');
    // React Cacheの制限により、実際のクリアは次回リクエスト時
  }
}