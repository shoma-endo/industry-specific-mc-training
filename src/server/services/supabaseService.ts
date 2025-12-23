import { SupabaseClient, type PostgrestError } from '@supabase/supabase-js';
import { SupabaseClientManager } from '@/lib/client-manager';
import {
  DbChatMessage,
  DbChatSession,
  DbChatSessionSearchRow,
} from '@/types/chat';
import type { DbUser } from '@/types/user';
import type { UserRole } from '@/types/user';
import type { GscCredential, GscPropertyType, GscSearchType } from '@/types/gsc';
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

  async searchChatSessions(
    userId: string,
    query: string,
    options?: { limit?: number }
  ): Promise<SupabaseResult<DbChatSessionSearchRow[]>> {
    const limit = options?.limit ?? 20;
    const { data, error } = await this.supabase.rpc('search_chat_sessions', {
      p_user_id: userId,
      p_query: query,
      p_limit: limit,
    });

    if (error) {
      return this.failure('チャットセッションの検索に失敗しました', {
        error,
        developerMessage: 'Failed to search chat sessions',
        context: { userId, query, limit },
      });
    }

    type SearchSessionRow = {
      session_id: string;
      title: string | null;
      canonical_url: string | null;
      wp_post_title: string | null;
      last_message_at: number | string | null;
      similarity_score: number | string | null;
    };

    const rows = (Array.isArray(data) ? data : []).map((row: SearchSessionRow) => ({
      session_id: String(row.session_id),
      title: typeof row.title === 'string' ? row.title : '',
      canonical_url:
        row.canonical_url === null || typeof row.canonical_url === 'string'
          ? row.canonical_url
          : null,
      wp_post_title:
        row.wp_post_title === null || typeof row.wp_post_title === 'string'
          ? row.wp_post_title
          : null,
      last_message_at: Number(row.last_message_at ?? 0),
      similarity_score:
        row.similarity_score === null || row.similarity_score === undefined
          ? 0
          : Number(row.similarity_score),
    })) as DbChatSessionSearchRow[];

    return this.success(rows);
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
      wpAccessToken: data.wp_access_token,
      wpRefreshToken: data.wp_refresh_token,
      wpTokenExpiresAt: data.wp_token_expires_at,
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
    options?: {
      wpContentTypes?: string[];
      accessToken?: string;
      refreshToken?: string;
      tokenExpiresAt?: string;
    }
  ): Promise<void> {
    const payload: Record<string, unknown> = {
      user_id: userId,
      wp_type: 'wordpress_com',
      wp_client_id: wpClientId,
      wp_client_secret: wpClientSecret, // 注意: 現状は平文で保存されます
      wp_site_id: wpSiteId,
      updated_at: new Date().toISOString(),
    };

    if (options && 'wpContentTypes' in options) {
      payload.wp_content_types = normalizeContentTypes(options.wpContentTypes);
    }
    if (options?.accessToken) payload.wp_access_token = options.accessToken;
    if (options?.refreshToken) payload.wp_refresh_token = options.refreshToken;
    if (options?.tokenExpiresAt) payload.wp_token_expires_at = options.tokenExpiresAt;

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

    if (options && 'wpContentTypes' in options) {
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

  async updateWordPressContentTypes(
    userId: string,
    wpContentTypes: string[]
  ): Promise<void> {
    const { error } = await this.supabase
      .from('wordpress_settings')
      .update({
        wp_content_types: normalizeContentTypes(wpContentTypes),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating WordPress content types:', error);
      throw new Error(`WordPress投稿タイプの更新に失敗しました: ${error.message}`);
    }
  }

  /**
   * WordPress.com アクセストークンをリフレッシュ
   */
  async refreshWpComToken(
    userId: string,
    wpSettings?: WordPressSettings
  ): Promise<
    | { success: true; accessToken: string; refreshToken?: string | null; expiresAt?: string | null }
    | { success: false; error: string }
  > {
    const settings = wpSettings ?? (await this.getWordPressSettingsByUserId(userId));
    if (!settings || settings.wpType !== 'wordpress_com') {
      return { success: false, error: 'WordPress.com設定が見つかりません' };
    }
    const clientId = settings.wpClientId || process.env.WORDPRESS_COM_CLIENT_ID;
    const clientSecret = settings.wpClientSecret || process.env.WORDPRESS_COM_CLIENT_SECRET;
    const refreshToken = settings.wpRefreshToken;

    if (!clientId || !clientSecret || !refreshToken) {
      return { success: false, error: 'クライアントID/シークレットまたはリフレッシュトークンが不足しています' };
    }

    try {
      const resp = await fetch('https://public-api.wordpress.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        return { success: false, error: `token refresh failed: ${resp.status} ${text}` };
      }

      const json = (await resp.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
      };
      if (!json.access_token) {
        return { success: false, error: 'token refresh failed: access_token missing' };
      }

      const expiresAt =
        json.expires_in && Number.isFinite(json.expires_in)
          ? new Date(Date.now() + Number(json.expires_in) * 1000).toISOString()
          : null;

      await this.supabase
        .from('wordpress_settings')
        .update({
          wp_access_token: json.access_token,
          wp_refresh_token: json.refresh_token ?? refreshToken,
          wp_token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      return {
        success: true,
        accessToken: json.access_token,
        refreshToken: json.refresh_token ?? refreshToken,
        expiresAt,
      };
    } catch (error) {
      console.error('[SupabaseService.refreshWpComToken] error', error);
      return { success: false, error: 'token refresh request failed' };
    }
  }

  /**
   * Google Search Console 資格情報を取得
   */
  async getGscCredentialByUserId(userId: string): Promise<GscCredential | null> {
    const { data, error } = await this.supabase
      .from('gsc_credentials')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch GSC credential:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      googleAccountEmail: data.google_account_email,
      refreshToken: data.refresh_token,
      accessToken: data.access_token,
      accessTokenExpiresAt: data.access_token_expires_at,
      scope: Array.isArray(data.scope) ? (data.scope as string[]) : null,
      propertyUri: data.property_uri,
      propertyType: data.property_type as GscPropertyType | null,
      propertyDisplayName: data.property_display_name,
      permissionLevel: data.permission_level,
      verified: data.verified,
      lastSyncedAt: data.last_synced_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Google Search Console 資格情報を保存
   */
  async upsertGscCredential(
    userId: string,
    payload: {
      refreshToken: string;
      googleAccountEmail?: string | null;
      accessToken?: string | null;
      accessTokenExpiresAt?: string | null;
      scope?: string[] | null;
      propertyUri?: string | null;
      propertyType?: GscPropertyType | null;
      propertyDisplayName?: string | null;
      permissionLevel?: string | null;
      verified?: boolean | null;
      lastSyncedAt?: string | null;
    }
  ): Promise<void> {
    const record: Record<string, unknown> = {
      user_id: userId,
      refresh_token: payload.refreshToken,
      google_account_email: payload.googleAccountEmail ?? null,
      access_token: payload.accessToken ?? null,
      access_token_expires_at: payload.accessTokenExpiresAt ?? null,
      scope: payload.scope ?? null,
      property_uri: payload.propertyUri ?? null,
      property_type: payload.propertyType ?? null,
      property_display_name: payload.propertyDisplayName ?? null,
      permission_level: payload.permissionLevel ?? null,
      verified: payload.verified ?? null,
      last_synced_at: payload.lastSyncedAt ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await this.supabase
      .from('gsc_credentials')
      .upsert(record, { onConflict: 'user_id' })
      .select();

    if (error) {
      console.error('Error upserting GSC credential:', error);
      throw new Error(`Google Search Console資格情報の保存に失敗しました: ${error.message}`);
    }
  }

  /**
   * Google Search Console 資格情報を部分更新
   */
  async updateGscCredential(
    userId: string,
    updates: Partial<{
      googleAccountEmail: string | null;
      accessToken: string | null;
      accessTokenExpiresAt: string | null;
      scope: string[] | null;
      propertyUri: string | null;
      propertyType: GscPropertyType | null;
      propertyDisplayName: string | null;
      permissionLevel: string | null;
      verified: boolean | null;
      lastSyncedAt: string | null;
    }>
  ): Promise<void> {
    const record: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if ('googleAccountEmail' in updates) {
      record.google_account_email = updates.googleAccountEmail ?? null;
    }
    if ('accessToken' in updates) {
      record.access_token = updates.accessToken ?? null;
    }
    if ('accessTokenExpiresAt' in updates) {
      record.access_token_expires_at = updates.accessTokenExpiresAt ?? null;
    }
    if ('scope' in updates) {
      record.scope = updates.scope ?? null;
    }
    if ('propertyUri' in updates) {
      record.property_uri = updates.propertyUri ?? null;
    }
    if ('propertyType' in updates) {
      record.property_type = updates.propertyType ?? null;
    }
    if ('propertyDisplayName' in updates) {
      record.property_display_name = updates.propertyDisplayName ?? null;
    }
    if ('permissionLevel' in updates) {
      record.permission_level = updates.permissionLevel ?? null;
    }
    if ('verified' in updates) {
      record.verified = updates.verified ?? null;
    }
    if ('lastSyncedAt' in updates) {
      record.last_synced_at = updates.lastSyncedAt ?? null;
    }

    const { error } = await this.supabase
      .from('gsc_credentials')
      .update(record)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating GSC credential:', error);
      throw new Error(`Google Search Console資格情報の更新に失敗しました: ${error.message}`);
    }
  }

  /**
   * Google Search Console 資格情報を削除
   */
  async deleteGscCredential(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('gsc_credentials')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('[SupabaseService] deleteGscCredential: エラー詳細', {
        userId,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
        fullError: error,
      });
      throw new Error(`Google Search Console資格情報の削除に失敗しました: ${error.message}`);
    }
  }

  async upsertGscQueryMetrics(
    rows: Array<{
      userId: string;
      propertyUri: string;
      propertyType: GscPropertyType;
      searchType: GscSearchType;
      date: string;
      url: string;
      normalizedUrl: string;
      query: string;
      queryNormalized: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
      contentAnnotationId?: string | null;
      importedAt: string;
    }>
  ): Promise<void> {
    if (!rows.length) {
      return;
    }

    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const nowIso = new Date().toISOString();
      const payload = chunk.map(row => ({
        user_id: row.userId,
        property_uri: row.propertyUri,
        property_type: row.propertyType,
        search_type: row.searchType,
        date: row.date,
        url: row.url,
        normalized_url: row.normalizedUrl,
        query: row.query,
        query_normalized: row.queryNormalized,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
        content_annotation_id: row.contentAnnotationId ?? null,
        imported_at: row.importedAt,
        created_at: row.importedAt,
        updated_at: nowIso,
      }));

      const { error } = await this.supabase.from('gsc_query_metrics').upsert(payload, {
        onConflict: 'user_id,property_uri,date,normalized_url,query_normalized,search_type',
      });

      if (error) {
        console.error('Error upserting GSC query metrics:', error);
        throw new Error(`Google Search Consoleクエリ指標の保存に失敗しました: ${error.message}`);
      }
    }
  }

  /**
   * 特定のアノテーションに関連付けられているが、現在の正規化URLとは異なるクエリ指標データを削除
   * URL変更時のデータ不整合（二重カウント）を解消するために使用
   */
  async cleanupOldGscQueryMetrics(annotationId: string, currentNormalizedUrl: string): Promise<void> {
    const { error: queryError } = await this.supabase
      .from('gsc_query_metrics')
      .delete()
      .eq('content_annotation_id', annotationId)
      .neq('normalized_url', currentNormalizedUrl);

    if (queryError) {
      console.error('[SupabaseService] cleanupOldGscQueryMetrics failed:', queryError);
      throw new Error(`以前のURLのクエリ指標データのクリーンアップに失敗しました: ${queryError.message}`);
    }
  }

  /**
   * チャットセッションとそれに紐づくすべてのメッセージ・コンテンツを削除
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

    // 2. セッションに紐づくコンテンツ注釈を削除
    const { error: annotationsError } = await this.supabase
      .from('content_annotations')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (annotationsError) {
      return this.failure('コンテンツ注釈の削除に失敗しました', {
        error: annotationsError,
        developerMessage: 'Failed to delete content annotations before session deletion',
        context: { sessionId, userId },
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

  /**
   * コンテンツ注釈を直接削除（孤立したコンテンツの削除用）
   */
  async deleteContentAnnotation(annotationId: string, userId: string): Promise<SupabaseResult<void>> {
    const { error } = await this.supabase
      .from('content_annotations')
      .delete()
      .eq('id', annotationId)
      .eq('user_id', userId);

    if (error) {
      return this.failure('コンテンツの削除に失敗しました', {
        error,
        developerMessage: 'Failed to delete content annotation',
        context: { annotationId, userId },
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
