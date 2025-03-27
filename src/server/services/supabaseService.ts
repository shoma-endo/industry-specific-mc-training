import { createClient } from '@supabase/supabase-js';
import { env } from '@/env';
import { DbChatMessage, DbChatSession } from '@/types/chat';

/**
 * SupabaseServiceクラス: サーバーサイドでSupabaseを操作するためのサービス
 * SERVICE_ROLEを使用して特権操作を提供
 */
export class SupabaseService {
  private supabaseAdmin;

  constructor() {
    // 環境変数からSupabase URLとサービスロールキーを取得
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRole = env.SUPABASE_SERVICE_ROLE;

    // 管理者権限を持つSupabaseクライアントの初期化
    this.supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async createChatSession(session: DbChatSession): Promise<string> {
    const { data, error } = await this.supabaseAdmin
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

  async getChatSessionById(sessionId: string): Promise<DbChatSession | null> {
    const { data, error } = await this.supabaseAdmin
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      console.error('Failed to get chat session:', error);
      return null;
    }

    return data;
  }

  async getUserChatSessions(userId: string): Promise<DbChatSession[]> {
    const { data, error } = await this.supabaseAdmin
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

  async updateChatSession(sessionId: string, updates: Partial<DbChatSession>): Promise<void> {
    const { error } = await this.supabaseAdmin
      .from('chat_sessions')
      .update(updates)
      .eq('id', sessionId);

    if (error) {
      console.error('Failed to update chat session:', error);
      throw new Error('チャットセッションの更新に失敗しました');
    }
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    const { error } = await this.supabaseAdmin
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      console.error('Failed to delete chat session:', error);
      throw new Error('チャットセッションの削除に失敗しました');
    }
  }

  async createChatMessage(message: DbChatMessage): Promise<string> {
    const { data, error } = await this.supabaseAdmin
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

  async getChatMessagesBySessionId(sessionId: string): Promise<DbChatMessage[]> {
    const { data, error } = await this.supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to get chat messages:', error);
      return [];
    }

    return data || [];
  }
}
