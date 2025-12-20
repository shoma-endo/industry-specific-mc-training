'use server';

import { withAuth } from '@/server/middleware/withAuth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';
import type { ContentCategory, ContentCategoryPayload } from '@/types/category';
import { DEFAULT_CATEGORY_COLOR } from '@/types/category';

const supabaseService = new SupabaseService();

/**
 * ユーザーのカテゴリ一覧を取得
 */
export async function getContentCategories(): Promise<
  { success: true; data: ContentCategory[] } | { success: false; error: string }
> {
  return withAuth(async ({ userId }) => {
    const client = supabaseService.getClient();
    const { data, error } = await client
      .from('content_categories')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      return { success: false as const, error: error.message };
    }

    return { success: true as const, data: (data ?? []) as ContentCategory[] };
  });
}

/**
 * カテゴリを作成
 */
export async function createContentCategory(
  payload: ContentCategoryPayload
): Promise<{ success: true; data: ContentCategory } | { success: false; error: string }> {
  return withAuth(async ({ userId }) => {
    const client = supabaseService.getClient();

    const trimmedName = payload.name.trim();
    if (!trimmedName) {
      return { success: false as const, error: 'カテゴリ名を入力してください' };
    }

    // 最大sort_orderを取得
    const { data: maxSortData } = await client
      .from('content_categories')
      .select('sort_order')
      .eq('user_id', userId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSortOrder = (maxSortData?.sort_order ?? -1) + 1;

    const { data, error } = await client
      .from('content_categories')
      .insert({
        user_id: userId,
        name: trimmedName,
        color: payload.color ?? DEFAULT_CATEGORY_COLOR,
        sort_order: payload.sort_order ?? nextSortOrder,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false as const, error: '同じ名前のカテゴリが既に存在します' };
      }
      return { success: false as const, error: error.message };
    }

    return { success: true as const, data: data as ContentCategory };
  });
}

/**
 * カテゴリを更新
 */
export async function updateContentCategory(
  categoryId: string,
  payload: Partial<ContentCategoryPayload>
): Promise<{ success: true; data: ContentCategory } | { success: false; error: string }> {
  return withAuth(async ({ userId }) => {
    const client = supabaseService.getClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.name !== undefined) {
      const trimmedName = payload.name.trim();
      if (!trimmedName) {
        return { success: false as const, error: 'カテゴリ名を入力してください' };
      }
      updateData.name = trimmedName;
    }

    if (payload.color !== undefined) {
      updateData.color = payload.color;
    }

    if (payload.sort_order !== undefined) {
      updateData.sort_order = payload.sort_order;
    }

    const { data, error } = await client
      .from('content_categories')
      .update(updateData)
      .eq('id', categoryId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false as const, error: '同じ名前のカテゴリが既に存在します' };
      }
      return { success: false as const, error: error.message };
    }

    if (!data) {
      return { success: false as const, error: 'カテゴリが見つかりません' };
    }

    return { success: true as const, data: data as ContentCategory };
  });
}

/**
 * カテゴリを削除
 */
export async function deleteContentCategory(
  categoryId: string
): Promise<{ success: true } | { success: false; error: string }> {
  return withAuth(async ({ userId }) => {
    const client = supabaseService.getClient();

    const { error } = await client
      .from('content_categories')
      .delete()
      .eq('id', categoryId)
      .eq('user_id', userId);

    if (error) {
      return { success: false as const, error: error.message };
    }

    return { success: true as const };
  });
}

/**
 * コンテンツにカテゴリを紐付け
 */
export async function setAnnotationCategories(
  annotationId: string,
  categoryIds: string[]
): Promise<{ success: true } | { success: false; error: string }> {
  return withAuth(async ({ userId }) => {
    const client = supabaseService.getClient();

    const { error } = await client.rpc('set_annotation_categories', {
      p_annotation_id: annotationId,
      p_category_ids: categoryIds,
      p_user_id: userId,
    });

    if (error) {
      if (error.message === 'Annotation not found') {
        return { success: false as const, error: 'コンテンツが見つかりません' };
      }
      return { success: false as const, error: error.message };
    }

    return { success: true as const };
  });
}

/**
 * コンテンツのカテゴリを取得
 */
export async function getAnnotationCategories(
  annotationId: string
): Promise<{ success: true; data: ContentCategory[] } | { success: false; error: string }> {
  return withAuth(async ({ userId }) => {
    const client = supabaseService.getClient();

    // アノテーションの所有者確認
    const { data: annotation, error: annotationError } = await client
      .from('content_annotations')
      .select('id')
      .eq('id', annotationId)
      .eq('user_id', userId)
      .single();

    if (annotationError || !annotation) {
      return { success: false as const, error: 'コンテンツが見つかりません' };
    }

    const { data, error } = await client
      .from('content_annotation_categories')
      .select('category_id, content_categories(*)')
      .eq('annotation_id', annotationId);

    if (error) {
      return { success: false as const, error: error.message };
    }

    // Supabaseの結合クエリでは content_categories が単一オブジェクトとして返される
    const categories = (data ?? [])
      .map(row => row.content_categories as unknown as ContentCategory | null)
      .filter((cat): cat is ContentCategory => cat !== null);

    return { success: true as const, data: categories };
  });
}

/**
 * 複数コンテンツのカテゴリをまとめて取得
 */
export async function getAnnotationCategoriesBatch(
  annotationIds: string[]
): Promise<
  { success: true; data: Record<string, ContentCategory[]> } | { success: false; error: string }
> {
  return withAuth(async ({ userId }) => {
    if (annotationIds.length === 0) {
      return { success: true as const, data: {} };
    }

    const client = supabaseService.getClient();

    // アノテーションの所有者確認
    const { data: annotations, error: annotationError } = await client
      .from('content_annotations')
      .select('id')
      .eq('user_id', userId)
      .in('id', annotationIds);

    if (annotationError) {
      return { success: false as const, error: annotationError.message };
    }

    const validIds = (annotations ?? []).map(a => a.id);

    if (validIds.length === 0) {
      return { success: true as const, data: {} };
    }

    const { data, error } = await client
      .from('content_annotation_categories')
      .select('annotation_id, category_id, content_categories(*)')
      .in('annotation_id', validIds);

    if (error) {
      return { success: false as const, error: error.message };
    }

    const result: Record<string, ContentCategory[]> = {};

    for (const row of data ?? []) {
      const annotationId = row.annotation_id;
      // Supabaseの結合クエリでは content_categories が単一オブジェクトとして返される
      const category = row.content_categories as unknown as ContentCategory | null;

      if (category) {
        if (!result[annotationId]) {
          result[annotationId] = [];
        }
        result[annotationId].push(category);
      }
    }

    return { success: true as const, data: result };
  });
}

/**
 * カテゴリの並び順を更新
 */
export async function updateCategorySortOrder(
  categoryIds: string[]
): Promise<{ success: true } | { success: false; error: string }> {
  return withAuth(async ({ userId }) => {
    const client = supabaseService.getClient();

    const { error } = await client.rpc('update_category_sort_orders', {
      p_category_ids: categoryIds,
      p_user_id: userId,
    });

    if (error) {
      return { success: false as const, error: error.message };
    }

    return { success: true as const };
  });
}
