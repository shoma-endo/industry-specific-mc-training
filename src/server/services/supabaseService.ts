import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseClientManager } from '@/lib/client-manager';
import { DbChatMessage, DbChatSession, DbSearchResult } from '@/types/chat';
import { WordPressSettings, WordPressType } from '@/types/wordpress';

/**
 * SupabaseServiceクラス: サーバーサイドでSupabaseを操作するためのサービス
 * SERVICE_ROLEを使用して特権操作を提供
 * 最適化：シングルトンクライアントで接続プールを効率化
 */
export class SupabaseService {
  protected readonly supabase: SupabaseClient;

  constructor() {
    // サーバーサイドの特権操作に対応するため、Service Roleクライアントを使用
    // （RLSをバイパスして安全にサーバー側でのみ実行）
    this.supabase = SupabaseClientManager.getInstance().getServiceRoleClient();
  }

  /**
   * Supabaseクライアントを取得（サブクラスからのアクセス用）
   */
  getClient(): SupabaseClient {
    return this.supabase;
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
   * 指定したユーザーのメッセージ数を、時間範囲でカウント
   * role は 'user' のみを対象（送信回数としてカウントするため）
   */
  async countUserMessagesBetween(userId: string, fromMs: number, toMs: number): Promise<number> {
    const { count, error } = await this.supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'user')
      .gte('created_at', fromMs)
      .lt('created_at', toMs);

    if (error) {
      console.error('Failed to count user messages:', error);
      return 0;
    }

    return count ?? 0;
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
      // テーブルが存在しない場合は無視する（42P01: relation does not exist）
      if (error.code === '42P01') {
        return;
      }
      console.error('Failed to delete search results:', error);
      throw new Error('検索結果の削除に失敗しました');
    }
  }

  /**
   * wordpress_settingsテーブルからユーザーのWordPress設定を取得（セルフホスト対応版）
   */
  async getWordPressSettingsByUserId(userId: string): Promise<WordPressSettings | null> {
    const { data, error } = await this.supabase
      .from('wordpress_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch WordPress settings:', error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      wpType: data.wp_type as WordPressType,
      wpClientId: data.wp_client_id,
      wpClientSecret: data.wp_client_secret,
      wpSiteId: data.wp_site_id,
      wpAccessToken: data.wp_access_token,
      wpRefreshToken: data.wp_refresh_token,
      wpTokenExpiresAt: data.wp_token_expires_at,
      wpSiteUrl: data.wp_site_url,
      wpUsername: data.wp_username,
      wpApplicationPassword: data.wp_application_password,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * wordpress_settingsテーブルにユーザーのWordPress設定を挿入または更新 (Upsert) - WordPress.com用
   */
  async createOrUpdateWordPressSettings(
    userId: string,
    wpClientId: string,
    wpClientSecret: string,
    wpSiteId: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('wordpress_settings')
      .upsert(
        {
          user_id: userId,
          wp_type: 'wordpress_com',
          wp_client_id: wpClientId,
          wp_client_secret: wpClientSecret, // 注意: 現状は平文で保存されます
          wp_site_id: wpSiteId,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id', // user_id が重複した場合は更新
        }
      )
      .select(); // .select() はコメントの意図を尊重し残す

    if (error) {
      console.error('Error upserting WordPress.com settings:', error);
      throw new Error(`WordPress.com設定の保存または更新に失敗しました: ${error.message}`);
    }
  }

  /**
   * wordpress_settingsテーブルにユーザーのセルフホストWordPress設定を挿入または更新 (Upsert)
   */
  async createOrUpdateSelfHostedWordPressSettings(
    userId: string,
    wpSiteUrl: string,
    wpUsername: string,
    wpApplicationPassword: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('wordpress_settings')
      .upsert(
        {
          user_id: userId,
          wp_type: 'self_hosted',
          wp_site_url: wpSiteUrl,
          wp_username: wpUsername,
          wp_application_password: wpApplicationPassword, // 注意: 現状は平文で保存されます
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id', // user_id が重複した場合は更新
        }
      )
      .select();

    if (error) {
      console.error('Error upserting self-hosted WordPress settings:', error);
      throw new Error(`セルフホストWordPress設定の保存または更新に失敗しました: ${error.message}`);
    }
  }

  /**
   * チャットセッションとそれに紐づくすべてのメッセージを削除
   */
  async deleteChatSession(sessionId: string, userId: string): Promise<void> {
    // トランザクション的な削除を実行
    // 1. セッションに紐づくメッセージを削除
    const { error: messagesError } = await this.supabase
      .from('chat_messages')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (messagesError) {
      console.error('Failed to delete chat messages:', messagesError);
      throw new Error('チャットメッセージの削除に失敗しました');
    }

    // 2. セッションに紐づく検索結果を削除（存在する場合）
    try {
      await this.deleteSearchResultsBySessionId(sessionId, userId);
    } catch (searchError) {
      // 検索結果の削除に失敗してもチャットセッション削除は継続する
      console.warn(
        'Failed to delete search results, but continuing with session deletion:',
        searchError
      );
    }

    // 3. セッション自体を削除
    const { error: sessionError } = await this.supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (sessionError) {
      console.error('Failed to delete chat session:', sessionError);
      throw new Error('チャットセッションの削除に失敗しました');
    }
  }

  /* === 要件定義 (briefs) ===================================== */

  /**
   * 事業者情報を保存
   */
  async saveBrief(userId: string, data: Record<string, unknown>): Promise<void> {
    const now = Date.now();
    const { error } = await this.supabase
      .from('briefs')
      .upsert(
        { user_id: userId, data, created_at: now, updated_at: now },
        { onConflict: 'user_id' }
      );

    if (error) {
      throw new Error(`事業者情報の保存に失敗しました: ${error.message}`);
    }
  }

  /**
   * 事業者情報を取得
   */
  async getBrief(userId: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.supabase
      .from('briefs')
      .select('data')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`事業者情報の取得に失敗しました: ${error.message}`);
    }

    return data?.data || null;
  }
}
