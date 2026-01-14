import { cache } from 'react';
import { SupabaseService } from '@/server/services/supabaseService';
import { briefInputSchema } from '@/server/schemas/brief.schema';
import type { BriefInput, Payment } from '@/server/schemas/brief.schema';

export interface Brief {
  id: string;
  user_id: string;
  data: BriefInput;
  created_at: string | null;
  updated_at: string | null;
}

export class BriefService {
  private static readonly supabaseService = new SupabaseService();

  /**
   * 旧形式のデータを新形式に変換
   */
  private static migrateOldBriefToNew(oldData: unknown): BriefInput {
    // すでに新形式かどうかをスキーマで検証
    const parseResult = briefInputSchema.safeParse(oldData);
    if (parseResult.success) {
      return parseResult.data;
    }

    const data = oldData as Record<string, unknown>;

    return {
      profile: {
        company: data.company as string | undefined,
        address: data.address as string | undefined,
        ceo: data.ceo as string | undefined,
        hobby: data.hobby as string | undefined,
        staff: data.staff as string | undefined,
        staffHobby: data.staffHobby as string | undefined,
        businessHours: data.businessHours as string | undefined,
        holiday: data.holiday as string | undefined,
        tel: data.tel as string | undefined,
        license: data.license as string | undefined,
        qualification: data.qualification as string | undefined,
        capital: data.capital as string | undefined,
        email: data.email as string | undefined,
        payments: data.payments as Payment[] | undefined,
        benchmarkUrl: data.benchmarkUrl as string | undefined,
        competitorCopy: data.competitorCopy as string | undefined,
      },
      persona: data.persona as string | undefined,
      services: [
        {
          id: crypto.randomUUID(),
          name: (data.service as string) || 'サービス1',
          strength: data.strength as string | undefined,
          when: data.when as string | undefined,
          where: data.where as string | undefined,
          who: data.who as string | undefined,
          why: data.why as string | undefined,
          what: data.what as string | undefined,
          how: data.how as string | undefined,
          price: data.price as string | undefined,
        },
      ],
    };
  }

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

      // dataフィールドをJson型から新形式に変換（必要に応じてマイグレーション）
      const briefData = this.migrateOldBriefToNew(data.data || {});

      return {
        id: data.id,
        user_id: data.user_id,
        data: briefData,
        created_at: data.created_at ?? null,
        updated_at: data.updated_at ?? null,
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
  static async getVariablesByUserId(userId: string): Promise<BriefInput | null> {
    const brief = await this.getCachedByUserId(userId);
    return brief?.data ?? null;
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
