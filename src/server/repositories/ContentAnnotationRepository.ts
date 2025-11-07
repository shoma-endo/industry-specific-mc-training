import { SupabaseService } from '../services/supabaseService';
import type { AnnotationRecord } from '@/types/annotation';

/**
 * ContentAnnotationRepository
 *
 * content_annotationsテーブルへのアクセスを一元管理するリポジトリクラス
 * 23箇所に散在していたクエリを5メソッドに集約（78%削減）
 */
export class ContentAnnotationRepository {
  private supabaseService: SupabaseService;

  constructor() {
    this.supabaseService = new SupabaseService();
  }

  /**
   * ユーザーの全注釈を取得（最新順）
   *
   * 使用箇所:
   * - wordpress.action.ts: getContentAnnotationsForUser
   * - app/api/admin/wordpress/bulk-import-posts/route.ts
   */
  async findByUserId(userId: string): Promise<AnnotationRecord[]> {
    return this.supabaseService.withServiceRoleClient(async (client) => {
      const { data, error } = await client
        .from('content_annotations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw new Error(`注釈の取得に失敗しました: ${error.message}`);
      return (data ?? []) as AnnotationRecord[];
    });
  }

  /**
   * ユーザーの注釈をページング取得（最新順、カウント付き）
   *
   * 使用箇所:
   * - analyticsContentService.ts: getPage
   */
  async findByUserIdWithPaging(
    userId: string,
    from: number,
    to: number
  ): Promise<{ data: AnnotationRecord[]; count: number }> {
    return this.supabaseService.withServiceRoleClient(async (client) => {
      const { data, error, count } = await client
        .from('content_annotations')
        .select('*', { count: 'exact', head: false })
        .eq('user_id', userId)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .range(from, to);

      if (error) throw new Error(`注釈の取得に失敗しました: ${error.message}`);
      return { data: (data ?? []) as AnnotationRecord[], count: count ?? 0 };
    });
  }

  /**
   * セッションIDで注釈を取得
   *
   * 使用箇所:
   * - wordpress.action.ts: ensureAnnotationChatSession
   * - app/api/chat/canvas/load-wordpress/route.ts
   */
  async findBySessionId(
    userId: string,
    sessionId: string
  ): Promise<AnnotationRecord | null> {
    return this.supabaseService.withServiceRoleClient(async (client) => {
      const { data, error } = await client
        .from('content_annotations')
        .select('*')
        .eq('user_id', userId)
        .eq('session_id', sessionId)
        .maybeSingle();

      if (error) throw new Error(`注釈の取得に失敗しました: ${error.message}`);
      return data as AnnotationRecord | null;
    });
  }

  /**
   * canonical URLのリスト取得（プロンプト用）
   *
   * 使用箇所:
   * - promptService.ts: buildContentVariables
   */
  async findCanonicalUrls(userId: string): Promise<Array<{
    canonical_url: string;
    wp_post_title: string
  }>> {
    return this.supabaseService.withServiceRoleClient(async (client) => {
      const { data, error } = await client
        .from('content_annotations')
        .select('canonical_url, wp_post_title')
        .eq('user_id', userId)
        .not('canonical_url', 'is', null)
        .order('updated_at', { ascending: false });

      if (error) throw new Error(`URLリストの取得に失敗しました: ${error.message}`);
      return data ?? [];
    });
  }

  /**
   * wp_post_idで既存の注釈を取得
   *
   * 使用箇所:
   * - wordpress.action.ts: upsertContentAnnotation（重複チェック）
   * - wordpress.action.ts: ensureAnnotationChatSession
   */
  async findByWpPostId(
    userId: string,
    wpPostId: number
  ): Promise<Pick<AnnotationRecord, 'canonical_url' | 'wp_post_id' | 'wp_post_title' | 'session_id'> | null> {
    return this.supabaseService.withServiceRoleClient(async (client) => {
      const { data, error } = await client
        .from('content_annotations')
        .select('canonical_url, wp_post_id, wp_post_title, session_id')
        .eq('user_id', userId)
        .eq('wp_post_id', wpPostId)
        .maybeSingle();

      if (error) throw new Error(`注釈の取得に失敗しました: ${error.message}`);
      return data;
    });
  }

  /**
   * canonical URLで重複チェック
   *
   * 使用箇所:
   * - wordpress.action.ts: upsertContentAnnotation（重複チェック）
   */
  async findDuplicatesByCanonicalUrl(
    userId: string,
    canonicalUrl: string
  ): Promise<Array<{ session_id: string | null; wp_post_id: number }>> {
    return this.supabaseService.withServiceRoleClient(async (client) => {
      const { data, error } = await client
        .from('content_annotations')
        .select('session_id, wp_post_id')
        .eq('user_id', userId)
        .eq('canonical_url', canonicalUrl);

      if (error) throw new Error(`重複チェックに失敗しました: ${error.message}`);
      return data ?? [];
    });
  }

  /**
   * 注釈のupsert
   *
   * 使用箇所:
   * - wordpress.action.ts: upsertContentAnnotation
   * - app/api/admin/wordpress/bulk-import-posts/route.ts
   */
  async upsert(annotation: Partial<AnnotationRecord> & {
    user_id: string;
    wp_post_id: number
  }): Promise<void> {
    return this.supabaseService.withServiceRoleClient(async (client) => {
      const { error } = await client
        .from('content_annotations')
        .upsert(annotation, { onConflict: 'user_id,wp_post_id' });

      if (error) throw new Error(`注釈の保存に失敗しました: ${error.message}`);
    });
  }

  /**
   * 注釈のupsert（session_idでマッチ）
   *
   * 使用箇所:
   * - wordpress.action.ts: upsertContentAnnotationBySession
   */
  async upsertBySessionId(annotation: Partial<AnnotationRecord> & {
    user_id: string;
    session_id: string
  }): Promise<void> {
    return this.supabaseService.withServiceRoleClient(async (client) => {
      const { error } = await client
        .from('content_annotations')
        .upsert(annotation, { onConflict: 'user_id,session_id' });

      if (error) throw new Error(`注釈の保存に失敗しました: ${error.message}`);
    });
  }

  /**
   * 注釈の更新（session_idでマッチ）
   *
   * 使用箇所:
   * - wordpress.action.ts: ensureAnnotationChatSession
   */
  async updateBySessionId(
    userId: string,
    sessionId: string,
    updates: Partial<AnnotationRecord>
  ): Promise<void> {
    return this.supabaseService.withServiceRoleClient(async (client) => {
      const { error } = await client
        .from('content_annotations')
        .update(updates)
        .eq('user_id', userId)
        .eq('session_id', sessionId);

      if (error) throw new Error(`注釈の更新に失敗しました: ${error.message}`);
    });
  }

  /**
   * 注釈の削除（session_idでマッチ）
   *
   * 使用箇所:
   * - wordpress.action.ts: ensureAnnotationChatSession（古いsession_idのクリア）
   */
  async clearSessionId(
    userId: string,
    wpPostId: number
  ): Promise<void> {
    return this.supabaseService.withServiceRoleClient(async (client) => {
      const { error } = await client
        .from('content_annotations')
        .update({ session_id: null })
        .eq('user_id', userId)
        .eq('wp_post_id', wpPostId);

      if (error) throw new Error(`セッションIDのクリアに失敗しました: ${error.message}`);
    });
  }

  /**
   * IDで注釈を取得（特定フィールドのみ）
   *
   * 使用箇所:
   * - wordpress.action.ts: ensureAnnotationChatSession
   */
  async findById(
    userId: string,
    id: string
  ): Promise<Pick<AnnotationRecord, 'id' | 'session_id' | 'wp_post_id'> | null> {
    return this.supabaseService.withServiceRoleClient(async (client) => {
      const { data, error } = await client
        .from('content_annotations')
        .select('id, session_id, wp_post_id')
        .eq('user_id', userId)
        .eq('id', id)
        .maybeSingle();

      if (error) throw new Error(`注釈の取得に失敗しました: ${error.message}`);
      return data;
    });
  }

  /**
   * IDで注釈を更新
   *
   * 使用箇所:
   * - wordpress.action.ts: ensureAnnotationChatSession
   */
  async updateById(
    userId: string,
    id: string,
    updates: Partial<AnnotationRecord>
  ): Promise<void> {
    return this.supabaseService.withServiceRoleClient(async (client) => {
      const { error } = await client
        .from('content_annotations')
        .update(updates)
        .eq('user_id', userId)
        .eq('id', id);

      if (error) throw new Error(`注釈の更新に失敗しました: ${error.message}`);
    });
  }

  /**
   * wp_post_idで注釈を更新
   *
   * 使用箇所:
   * - wordpress.action.ts: ensureAnnotationChatSession
   */
  async updateByWpPostId(
    userId: string,
    wpPostId: number,
    updates: Partial<AnnotationRecord>
  ): Promise<void> {
    return this.supabaseService.withServiceRoleClient(async (client) => {
      const { error } = await client
        .from('content_annotations')
        .update(updates)
        .eq('user_id', userId)
        .eq('wp_post_id', wpPostId);

      if (error) throw new Error(`注釈の更新に失敗しました: ${error.message}`);
    });
  }

  /**
   * 注釈を新規作成
   *
   * 使用箇所:
   * - wordpress.action.ts: ensureAnnotationChatSession
   */
  async insert(annotation: Partial<AnnotationRecord> & {
    user_id: string
  }): Promise<void> {
    return this.supabaseService.withServiceRoleClient(async (client) => {
      const { error } = await client
        .from('content_annotations')
        .insert(annotation);

      if (error) throw new Error(`注釈の作成に失敗しました: ${error.message}`);
    });
  }
}
