import { createClient } from '@supabase/supabase-js';
import { env } from '@/env';
import { DbChatMessage, DbChatSession, DbSearchResult } from '@/types/chat';

/**
 * SupabaseServiceクラス: サーバーサイドでSupabaseを操作するためのサービス
 * SERVICE_ROLEを使用して特権操作を提供
 */
export class SupabaseService {
  supabase;

  constructor() {
    // 環境変数からSupabase URLとサービスロールキーを取得
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRole = env.SUPABASE_SERVICE_ROLE;

    // 管理者権限を持つSupabaseクライアントの初期化
    this.supabase = createClient(supabaseUrl, supabaseServiceRole, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * ユーザープロフィールを保存または更新
   */
  async saveUserProfile(
    userId: string,
    lineProfile: { displayName: string; pictureUrl?: string; statusMessage?: string }
  ) {
    const { data, error } = await this.supabase
      .from('users')
      .upsert(
        {
          line_user_id: userId,
          line_display_name: lineProfile.displayName,
          line_picture_url: lineProfile.pictureUrl,
          line_status_message: lineProfile.statusMessage,
          updated_at: Date.now(),
        },
        { onConflict: 'line_user_id' }
      )
      .select();

    if (error) {
      console.error('Error saving user profile:', error);
      throw error;
    }

    return data;
  }

  /**
   * ユーザー情報をLINE IDで取得
   */
  async getUserByLineId(lineUserId: string) {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('line_user_id', lineUserId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error getting user by LINE ID:', error);
      throw error;
    }

    return data;
  }

  async createChatSession(session: DbChatSession): Promise<string> {
    const { data, error } = await this.supabase
      .from('chat_sessions')
      .insert(session)
      .select('id')
      .single();

    if (error) {
      console.error('Failed to create chat session:', error);
      throw new Error('チャットセッションの作成に失敗しました');
    }

    return data.id;
  }

  async getChatSessionById(sessionId: string, userId: string): Promise<DbChatSession | null> {
    const { data, error } = await this.supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Failed to get chat session:', error);
      return null;
    }

    return data;
  }

  async getUserChatSessions(userId: string): Promise<DbChatSession[]> {
    const { data, error } = await this.supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('Failed to get user chat sessions:', error);
      return [];
    }

    return data || [];
  }

  async updateChatSession(
    sessionId: string,
    userId: string,
    updates: Partial<DbChatSession>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('chat_sessions')
      .update(updates)
      .eq('id', sessionId)
      .eq('user_id', userId); // これがないと他人のチャット履歴も更新できてしまう

    if (error) {
      console.error('Failed to update chat session:', error);
      throw new Error('チャットセッションの更新に失敗しました');
    }
  }

  async deleteChatSession(sessionId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', userId); // これがないと他人のチャット履歴も削除できてしまう

    if (error) {
      console.error('Failed to delete chat session:', error);
      throw new Error('チャットセッションの削除に失敗しました');
    }
  }

  async createChatMessage(message: DbChatMessage): Promise<string> {
    const { data, error } = await this.supabase
      .from('chat_messages')
      .insert(message)
      .select('id')
      .single();

    if (error) {
      console.error('Failed to create chat message:', error);
      throw new Error('チャットメッセージの作成に失敗しました');
    }

    return data.id;
  }

  async getChatMessagesBySessionId(sessionId: string, userId: string): Promise<DbChatMessage[]> {
    const { data, error } = await this.supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId) // これがないと他人のチャット履歴も取得できてしまう
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to get chat messages:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Google検索結果を一括で保存
   */
  async createSearchResults(results: DbSearchResult[]): Promise<void> {
    const { error } = await this.supabase.from('search_results').insert(results);

    if (error) {
      console.error('Failed to create search results:', error);
      throw new Error('検索結果の保存に失敗しました');
    }
  }

  /**
   * セッションに紐づく検索結果を取得
   */
  async getSearchResultsBySessionId(sessionId: string, userId: string): Promise<DbSearchResult[]> {
    const { data, error } = await this.supabase
      .from('search_results')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('rank', { ascending: true });

    if (error) {
      console.error('Failed to get search results:', error);
      return [];
    }
    return data || [];
  }

  /**
   * セッションに紐づく検索結果を削除
   */
  async deleteSearchResultsBySessionId(sessionId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('search_results')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to delete search results:', error);
      throw new Error('検索結果の削除に失敗しました');
    }
  }
}
