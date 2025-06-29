import { v4 as uuidv4 } from 'uuid';
import { SupabaseService } from './supabaseService';
import { User, DbUser, toUser, toDbUser } from '@/types/user';

/**
 * ユーザーリポジトリ: ユーザーデータのCRUD操作を提供
 * SupabaseServiceを継承して最適化されたクライアントを利用
 */
export class UserRepository extends SupabaseService {
  constructor() {
    super();
  }

  /**
   * アプリケーションのユーザーIDでユーザーを検索
   * @param id アプリケーションのユーザーID (UUID)
   * @returns ユーザーオブジェクト、見つからなければnull
   */
  async findById(id: string): Promise<User | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', id) // 'id' カラムで検索
        .single(); // IDはユニークなので single() を使用

      if (error) {
        // 'PGRST116' は該当する行が見つからなかった場合のエラーコード
        // この場合はエラーではなく、nullを返すのが適切
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error(`Error finding user by ID (${id}):`, error);
        return null; // その他のエラーの場合もnullを返すか、エラーをスローするか検討
      }

      return data ? toUser(data as DbUser) : null;
    } catch (error) {
      console.error('Repository error (findById):', error);
      return null;
    }
  }

  /**
   * ユーザーをLINE UserIDで検索
   */
  async findByLineUserId(lineUserId: string): Promise<User | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('line_user_id', lineUserId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // ユーザーが見つからない場合はnullを返す
        }
        console.error('Error finding user by LINE user ID:', error);
        return null;
      }

      return data ? toUser(data as DbUser) : null;
    } catch (error) {
      console.error('Repository error (findByLineUserId):', error);
      return null;
    }
  }

  /**
   * ユーザーをStripeカスタマーIDで検索
   */
  async findByStripeCustomerId(stripeCustomerId: string): Promise<User | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('stripe_customer_id', stripeCustomerId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // ユーザーが見つからない場合はnullを返す
        }
        console.error('Error finding user by Stripe customer ID:', error);
        return null;
      }

      return data ? toUser(data as DbUser) : null;
    } catch (error) {
      console.error('Repository error (findByStripeCustomerId):', error);
      return null;
    }
  }

  /**
   * 新規ユーザーを作成
   */
  async create(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User | null> {
    try {
      const now = Date.now();
      const user: User = {
        id: uuidv4(),
        createdAt: now,
        updatedAt: now,
        ...userData,
      };

      const { error } = await this.supabase.from('users').insert(toDbUser(user));

      if (error) {
        console.error('Error creating user:', error);
        return null;
      }

      return user;
    } catch (error) {
      console.error('Repository error (create):', error);
      return null;
    }
  }

  /**
   * ユーザー情報を更新
   */
  async update(userId: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<boolean> {
    try {
      const dbUpdates: Partial<DbUser> = {
        updated_at: Date.now(),
      };

      if (updates.lineDisplayName !== undefined)
        dbUpdates.line_display_name = updates.lineDisplayName;
      if (updates.linePictureUrl !== undefined) dbUpdates.line_picture_url = updates.linePictureUrl;
      if (updates.lineStatusMessage !== undefined)
        dbUpdates.line_status_message = updates.lineStatusMessage;
      if (updates.stripeCustomerId !== undefined)
        dbUpdates.stripe_customer_id = updates.stripeCustomerId;
      if (updates.stripeSubscriptionId !== undefined)
        dbUpdates.stripe_subscription_id = updates.stripeSubscriptionId;
      if (updates.googleSearchCount !== undefined)
        dbUpdates.google_search_count = updates.googleSearchCount;

      const { error } = await this.supabase
        .from('users')
        .update(dbUpdates)
        .eq('id', userId);

      if (error) {
        console.error('Error updating user:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Repository error (update):', error);
      return false;
    }
  }

  /**
   * LINEユーザーIDに基づいてStripeカスタマーIDを更新
   */
  async updateStripeCustomerId(lineUserId: string, stripeCustomerId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('users')
        .update({
          stripe_customer_id: stripeCustomerId,
          updated_at: Date.now(),
        })
        .eq('line_user_id', lineUserId);

      if (error) {
        console.error('Error updating Stripe customer ID:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Repository error (updateStripeCustomerId):', error);
      return false;
    }
  }

  /**
   * LINEユーザーIDに基づいてStripeサブスクリプションIDを更新
   */
  async updateStripeSubscriptionId(
    lineUserId: string,
    stripeSubscriptionId: string
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('users')
        .update({
          stripe_subscription_id: stripeSubscriptionId,
          updated_at: Date.now(),
        })
        .eq('line_user_id', lineUserId);

      if (error) {
        console.error('Error updating Stripe subscription ID:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Repository error (updateStripeSubscriptionId):', error);
      return false;
    }
  }

  /**
   * Google Search API利用回数をインクリメント
   */
  async incrementGoogleSearchCount(userId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.rpc('increment_google_search_count', {
        user_id: userId
      });

      if (error) {
        console.error('Error incrementing Google search count:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Repository error (incrementGoogleSearchCount):', error);
      return false;
    }
  }
}

export const userRepository = new UserRepository();
