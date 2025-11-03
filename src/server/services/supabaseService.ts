import { SupabaseClient, type PostgrestError } from '@supabase/supabase-js';
import { SupabaseClientManager } from '@/lib/client-manager';
import { DbChatMessage, DbChatSession, DbSearchResult } from '@/types/chat';
import type { DbUser } from '@/types/user';
import type { UserRole } from '@/types/user';
import { WordPressSettings, WordPressType } from '@/types/wordpress';
import { normalizeContentTypes } from '@/server/services/wordpressContentTypes';

export interface SupabaseErrorInfo {
  userMessage: string;
  developerMessage?: string | undefined;
  code?: string | undefined;
  details?: string | null | undefined;
  hint?: string | null | undefined;
  context?: Record<string, unknown> | undefined;
}

export type SupabaseResult<T> =
  | { success: true; data: T }
  | { success: false; error: SupabaseErrorInfo };

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

  protected success<T>(data: T): SupabaseResult<T> {
    return { success: true, data };
  }

  protected failure(
    userMessage: string,
    {
      error,
      developerMessage,
      context,
    }: {
      error?: PostgrestError | Error;
      developerMessage?: string;
      context?: Record<string, unknown>;
    } = {}
  ): SupabaseResult<never> {
    const info: SupabaseErrorInfo = {
      userMessage,
    };

    if (developerMessage !== undefined) {
      info.developerMessage = developerMessage;
    }

    if (context !== undefined) {
      info.context = context;
    }

    if (info.developerMessage === undefined) {
      info.developerMessage = userMessage;
    }

    if (error) {
      if ('code' in error && typeof error.code === 'string') {
        info.code = error.code;
      }
      if ('details' in error && typeof error.details !== 'undefined') {
        info.details = error.details as string | null | undefined;
      }
      if ('hint' in error && typeof error.hint !== 'undefined') {
        info.hint = error.hint as string | null | undefined;
      }

      console.error('[SupabaseService] Operation failed:', {
        developerMessage: info.developerMessage ?? developerMessage,
        code: info.code,
        details: info.details,
        hint: info.hint,
        context: info.context,
        rawError: error,
      });
    } else {
      console.error('[SupabaseService] Operation failed without PostgrestError', {
        developerMessage: info.developerMessage ?? developerMessage,
        context: info.context ?? context,
      });
    }

    return { success: false, error: info };
  }

  /**
   * Supabaseクライアントを取得（サブクラスからのアクセス用）
   */
  getClient(): SupabaseClient {
    return this.supabase;
  }

  protected static async withServiceRoleClient<T>(
    handler: (client: SupabaseClient) => Promise<T>,
    options?: {
      logMessage?: string | null;
      logLevel?: 'error' | 'warn' | 'info' | 'debug';
      onError?: (error: unknown) => T;
    }
  ): Promise<T> {
    const client = SupabaseClientManager.getInstance().getServiceRoleClient();

    try {
      return await handler(client);
    } catch (error) {
      const { logLevel = 'error', logMessage = 'Supabase service role operation error' } =
        options ?? {};

      if (logMessage) {
        console[logLevel](logMessage, error);
      }

      if (options?.onError) {
        return options.onError(error);
      }

      throw error;
    }
  }

  /**
   * ユーザープロフィールを保存または更新
   */
  async saveUserProfile(
    userId: string,
    lineProfile: { displayName: string; pictureUrl?: string; statusMessage?: string }
  ): Promise<SupabaseResult<unknown[]>> {
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
      return this.failure('ユーザープロフィールの保存に失敗しました', {
        error,
        developerMessage: 'Error saving user profile',
        context: { lineUserId: userId },
      });
    }

    return this.success(data ?? []);
  }

  /**
   * ユーザー情報をLINE IDで取得
   */
  async getUserByLineId(lineUserId: string): Promise<SupabaseResult<DbUser | null>> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('line_user_id', lineUserId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return this.failure('ユーザー情報の取得に失敗しました', {
        error,
        developerMessage: 'Error getting user by LINE ID',
        context: { lineUserId },
      });
    }

    return this.success((data as DbUser) ?? null);
  }

  async getUserById(id: string): Promise<SupabaseResult<DbUser | null>> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return this.failure('ユーザー情報の取得に失敗しました', {
        error,
        developerMessage: 'Error getting user by ID',
        context: { id },
      });
    }

    return this.success((data as DbUser) ?? null);
  }

  async getUserByStripeCustomerId(stripeCustomerId: string): Promise<SupabaseResult<DbUser | null>> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle();

    if (error) {
      return this.failure('ユーザー情報の取得に失敗しました', {
        error,
        developerMessage: 'Error getting user by Stripe customer ID',
        context: { stripeCustomerId },
      });
    }

    return this.success((data as DbUser) ?? null);
  }

  async createUser(user: DbUser): Promise<SupabaseResult<DbUser>> {
    const { data, error } = await this.supabase
      .from('users')
      .insert(user)
      .select('*')
      .single();

    if (error) {
      return this.failure('ユーザーの作成に失敗しました', {
        error,
        developerMessage: 'Error creating user',
        context: { userId: user.id, lineUserId: user.line_user_id },
      });
    }

    return this.success((data as DbUser) ?? user);
  }

  async updateUserById(
    id: string,
    updates: Partial<DbUser>
  ): Promise<SupabaseResult<DbUser | null>> {
    const { data, error } = await this.supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      return this.failure('ユーザー情報の更新に失敗しました', {
        error,
        developerMessage: 'Error updating user by ID',
        context: { id, updates },
      });
    }

    return this.success((data as DbUser) ?? null);
  }

  async updateUserByLineUserId(
    lineUserId: string,
    updates: Partial<DbUser>
  ): Promise<SupabaseResult<DbUser | null>> {
    const { data, error } = await this.supabase
      .from('users')
      .update(updates)
      .eq('line_user_id', lineUserId)
      .select('*')
      .maybeSingle();

    if (error) {
      return this.failure('ユーザー情報の更新に失敗しました', {
        error,
        developerMessage: 'Error updating user by LINE user ID',
        context: { lineUserId, updates },
      });
    }

    return this.success((data as DbUser) ?? null);
  }

  async updateUserRole(userId: string, newRole: UserRole): Promise<SupabaseResult<DbUser | null>> {
    return this.updateUserById(userId, {
      role: newRole,
      updated_at: Date.now(),
    });
  }

  async getAllUsers(): Promise<SupabaseResult<DbUser[]>> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return this.failure('ユーザー一覧の取得に失敗しました', {
        error,
        developerMessage: 'Error fetching all users',
      });
    }

    return this.success((data as DbUser[]) ?? []);
  }

  async createChatSession(session: DbChatSession): Promise<SupabaseResult<string>> {
    const { data, error } = await this.supabase
      .from('chat_sessions')
      .insert(session)
      .select('id')
      .single();

    if (error) {
      return this.failure('チャットセッションの作成に失敗しました', {
        error,
        developerMessage: 'Failed to create chat session',
        context: { sessionId: session.id, userId: session.user_id },
      });
    }

    if (!data?.id) {
      return this.failure('チャットセッションの作成に失敗しました', {
        developerMessage: 'Chat session insert returned no id',
        context: { session },
      });
    }

    return this.success(data.id);
  }

  async getChatSessionById(
    sessionId: string,
    userId: string
  ): Promise<SupabaseResult<DbChatSession | null>> {
    const { data, error } = await this.supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return this.success(null);
      }
      return this.failure('チャットセッションの取得に失敗しました', {
        error,
        developerMessage: 'Failed to get chat session',
        context: { sessionId, userId },
      });
    }

    return this.success(data ?? null);
  }

  async getUserChatSessions(userId: string): Promise<SupabaseResult<DbChatSession[]>> {
    const { data, error } = await this.supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false });

    if (error) {
      return this.failure('チャットセッションの取得に失敗しました', {
        error,
        developerMessage: 'Failed to get user chat sessions',
        context: { userId },
      });
    }

    return this.success(data ?? []);
  }

  async updateChatSession(
    sessionId: string,
    userId: string,
    updates: Partial<DbChatSession>
  ): Promise<SupabaseResult<void>> {
    const { error } = await this.supabase
      .from('chat_sessions')
      .update(updates)
      .eq('id', sessionId)
      .eq('user_id', userId); // これがないと他人のチャット履歴も更新できてしまう

    if (error) {
      return this.failure('チャットセッションの更新に失敗しました', {
        error,
        developerMessage: 'Failed to update chat session',
        context: { sessionId, userId, updates },
      });
    }

    return this.success(undefined);
  }

  async createChatMessage(message: DbChatMessage): Promise<SupabaseResult<string>> {
    const { data, error } = await this.supabase
      .from('chat_messages')
      .insert(message)
      .select('id')
      .single();

    if (error) {
      return this.failure('チャットメッセージの作成に失敗しました', {
        error,
        developerMessage: 'Failed to create chat message',
        context: { messageId: message.id, sessionId: message.session_id, userId: message.user_id },
      });
    }

    if (!data?.id) {
      return this.failure('チャットメッセージの作成に失敗しました', {
        developerMessage: 'Chat message insert returned no id',
        context: { message },
      });
    }

    return this.success(data.id);
  }

  async getChatMessagesBySessionId(
    sessionId: string,
    userId: string
  ): Promise<SupabaseResult<DbChatMessage[]>> {
    const { data, error } = await this.supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId) // これがないと他人のチャット履歴も取得できてしまう
      .order('created_at', { ascending: true });

    if (error) {
      return this.failure('チャットメッセージの取得に失敗しました', {
        error,
        developerMessage: 'Failed to get chat messages',
        context: { sessionId, userId },
      });
    }

    return this.success(data ?? []);
  }

  /**
   * 指定したユーザーのメッセージ数を、時間範囲でカウント
   * role は 'user' のみを対象（送信回数としてカウントするため）
   */
  async countUserMessagesBetween(
    userId: string,
    fromMs: number,
    toMs: number
  ): Promise<SupabaseResult<number>> {
    const { count, error } = await this.supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'user')
      .gte('created_at', fromMs)
      .lt('created_at', toMs);

    if (error) {
      return this.failure('メッセージ数の取得に失敗しました', {
        error,
        developerMessage: 'Failed to count user messages in range',
        context: { userId, fromMs, toMs },
      });
    }

    return this.success(count ?? 0);
  }

  /**
   * Google検索結果を一括で保存
   */
  async createSearchResults(results: DbSearchResult[]): Promise<SupabaseResult<void>> {
    const { error } = await this.supabase.from('search_results').insert(results);

    if (error) {
      return this.failure('検索結果の保存に失敗しました', {
        error,
        developerMessage: 'Failed to create search results',
      });
    }

    return this.success(undefined);
  }

  /**
   * セッションに紐づく検索結果を取得
   */
  async getSearchResultsBySessionId(
    sessionId: string,
    userId: string
  ): Promise<SupabaseResult<DbSearchResult[]>> {
    const { data, error } = await this.supabase
      .from('search_results')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('rank', { ascending: true });

    if (error) {
      return this.failure('検索結果の取得に失敗しました', {
        error,
        developerMessage: 'Failed to get search results by session',
        context: { sessionId, userId },
      });
    }
    return this.success(data ?? []);
  }

  /**
   * セッションに紐づく検索結果を削除
   */
  async deleteSearchResultsBySessionId(
    sessionId: string,
    userId: string
  ): Promise<SupabaseResult<void>> {
    const { error } = await this.supabase
      .from('search_results')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (error) {
      // テーブルが存在しない場合は無視する（42P01: relation does not exist）
      if (error.code === '42P01') {
        return this.success(undefined);
      }
      return this.failure('検索結果の削除に失敗しました', {
        error,
        developerMessage: 'Failed to delete search results by session',
        context: { sessionId, userId },
      });
    }

    return this.success(undefined);
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
      wpSiteUrl: data.wp_site_url,
      wpUsername: data.wp_username,
      wpApplicationPassword: data.wp_application_password,
      wpContentTypes: normalizeContentTypes(data.wp_content_types as string[] | null),
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
    wpSiteId: string,
    options?: { wpContentTypes?: string[] }
  ): Promise<void> {
    const payload: Record<string, unknown> = {
      user_id: userId,
      wp_type: 'wordpress_com',
      wp_client_id: wpClientId,
      wp_client_secret: wpClientSecret, // 注意: 現状は平文で保存されます
      wp_site_id: wpSiteId,
      updated_at: new Date().toISOString(),
    };

    if (options?.wpContentTypes) {
      payload.wp_content_types = normalizeContentTypes(options.wpContentTypes);
    }

    const { error } = await this.supabase
      .from('wordpress_settings')
      .upsert(payload, {
        onConflict: 'user_id', // user_id が重複した場合は更新
      })
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
    wpApplicationPassword: string,
    options?: { wpContentTypes?: string[] }
  ): Promise<void> {
    const payload: Record<string, unknown> = {
      user_id: userId,
      wp_type: 'self_hosted',
      wp_site_url: wpSiteUrl,
      wp_username: wpUsername,
      wp_application_password: wpApplicationPassword, // 注意: 現状は平文で保存されます
      updated_at: new Date().toISOString(),
    };

    if (options?.wpContentTypes) {
      payload.wp_content_types = normalizeContentTypes(options.wpContentTypes);
    }

    const { error } = await this.supabase
      .from('wordpress_settings')
      .upsert(payload, {
        onConflict: 'user_id', // user_id が重複した場合は更新
      })
      .select();

    if (error) {
      console.error('Error upserting self-hosted WordPress settings:', error);
      throw new Error(`セルフホストWordPress設定の保存または更新に失敗しました: ${error.message}`);
    }
  }

  /**
   * チャットセッションとそれに紐づくすべてのメッセージを削除
   */
  async deleteChatSession(sessionId: string, userId: string): Promise<SupabaseResult<void>> {
    // トランザクション的な削除を実行
    // 1. セッションに紐づくメッセージを削除
    const { error: messagesError } = await this.supabase
      .from('chat_messages')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (messagesError) {
      return this.failure('チャットメッセージの削除に失敗しました', {
        error: messagesError,
        developerMessage: 'Failed to delete chat messages before session deletion',
        context: { sessionId, userId },
      });
    }

    // 2. セッションに紐づく検索結果を削除（存在する場合）
    const searchResultDeletion = await this.deleteSearchResultsBySessionId(sessionId, userId);
    if (!searchResultDeletion.success) {
      console.warn('Failed to delete search results, but continuing with session deletion:', {
        sessionId,
        userId,
        error: searchResultDeletion.error,
      });
    }

    // 3. セッション自体を削除
    const { error: sessionError } = await this.supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (sessionError) {
      return this.failure('チャットセッションの削除に失敗しました', {
        error: sessionError,
        developerMessage: 'Failed to delete chat session',
        context: { sessionId, userId },
      });
    }

    return this.success(undefined);
  }

  /* === 要件定義 (briefs) ===================================== */

  /**
   * 事業者情報を保存
   */
  async saveBrief(userId: string, data: Record<string, unknown>): Promise<SupabaseResult<void>> {
    const now = Date.now();
    const { error } = await this.supabase
      .from('briefs')
      .upsert(
        { user_id: userId, data, created_at: now, updated_at: now },
        { onConflict: 'user_id' }
      );

    if (error) {
      return this.failure('事業者情報の保存に失敗しました', {
        error,
        developerMessage: 'Failed to upsert brief',
        context: { userId },
      });
    }

    return this.success(undefined);
  }

  /**
   * 事業者情報を取得
   */
  async getBrief(userId: string): Promise<SupabaseResult<Record<string, unknown> | null>> {
    const { data, error } = await this.supabase
      .from('briefs')
      .select('data')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return this.failure('事業者情報の取得に失敗しました', {
        error,
        developerMessage: 'Failed to get brief',
        context: { userId },
      });
    }

    return this.success((data?.data as Record<string, unknown>) || null);
  }

  /* === メッセージ保存機能 ================================ */

  /**
   * メッセージの保存状態を更新
   */
  async setMessageSaved(
    userId: string,
    messageId: string,
    isSaved: boolean
  ): Promise<SupabaseResult<void>> {
    const { error } = await this.supabase
      .from('chat_messages')
      .update({ is_saved: isSaved })
      .eq('id', messageId)
      .eq('user_id', userId);

    if (error) {
      return this.failure('メッセージの保存状態更新に失敗しました', {
        error,
        developerMessage: 'Failed to update is_saved flag',
        context: { messageId, userId, isSaved },
      });
    }

    return this.success(undefined);
  }

  /**
   * セッション内の保存済みメッセージIDを取得
   */
  async getSavedMessageIdsBySession(
    userId: string,
    sessionId: string
  ): Promise<SupabaseResult<string[]>> {
    const { data, error } = await this.supabase
      .from('chat_messages')
      .select('id')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .eq('is_saved', true)
      .order('created_at', { ascending: true });

    if (error) {
      return this.failure('保存済みメッセージIDの取得に失敗しました', {
        error,
        developerMessage: 'Failed to fetch saved message ids by session',
        context: { userId, sessionId },
      });
    }

    return this.success((data || []).map(r => r.id));
  }

  /**
   * 全保存済みメッセージを取得
   */
  async getAllSavedMessages(
    userId: string
  ): Promise<SupabaseResult<
    Array<{ id: string; content: string; created_at: number; session_id: string }>
  >> {
    const { data, error } = await this.supabase
      .from('chat_messages')
      .select('id, content, created_at, session_id')
      .eq('user_id', userId)
      .eq('is_saved', true)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      return this.failure('保存済みメッセージの取得に失敗しました', {
        error,
        developerMessage: 'Failed to fetch all saved messages',
        context: { userId },
      });
    }

    return this.success(
      (data || []) as Array<{ id: string; content: string; created_at: number; session_id: string }>
    );
  }
}
