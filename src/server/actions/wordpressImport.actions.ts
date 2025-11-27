'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';
import { buildWordPressServiceFromSettings } from '@/server/services/wordpressContext';
import { normalizeWordPressRestPosts } from '@/server/services/wordpressService';
import { normalizeContentTypes, normalizeContentType } from '@/server/services/wordpressContentTypes';
import type { WordPressNormalizedPost } from '@/types/wordpress';
import { ERROR_MESSAGES } from '@/domain/errors/error-messages';

export async function runWordpressBulkImport(accessToken: string) {
  try {
    const authResult = await authMiddleware(accessToken);
    if (authResult.error || !authResult.userId) {
      return { success: false, error: authResult.error || ERROR_MESSAGES.AUTH.LIFF_AUTH_FAILED };
    }

    const supabaseService = new SupabaseService();
    const supabaseClient = supabaseService.getClient();
    const userId = authResult.userId;
    const wpSettings = await supabaseService.getWordPressSettingsByUserId(userId);
    if (!wpSettings) {
      return { success: false, error: ERROR_MESSAGES.WORDPRESS.SETTINGS_INCOMPLETE };
    }

    const cookieStore = await cookies();
    const buildResult = buildWordPressServiceFromSettings(
      wpSettings,
      name => cookieStore.get(name)?.value
    );

    if (!buildResult.success) {
      return {
        success: false,
        error: buildResult.message,
        needsWordPressAuth: buildResult.needsWordPressAuth ?? false,
      };
    }

    const wpService = buildResult.service;

    const perPage = 100;
    let contentTypes = normalizeContentTypes(wpSettings.wpContentTypes);

    if (contentTypes.length === 0) {
      const fetchedTypesResult = await wpService.fetchAvailableContentTypes();
      if (!fetchedTypesResult.success || !Array.isArray(fetchedTypesResult.data)) {
        return {
          success: false,
          error:
            fetchedTypesResult.error || ERROR_MESSAGES.WORDPRESS.CONTENT_TYPE_FETCH_FAILED,
        };
      }

      const autoContentTypes = normalizeContentTypes(fetchedTypesResult.data);
      if (autoContentTypes.length === 0) {
        return { success: false, error: ERROR_MESSAGES.WORDPRESS.CONTENT_TYPE_FETCH_FAILED };
      }

      await supabaseService.updateWordPressContentTypes(userId, autoContentTypes);
      contentTypes = autoContentTypes;
    }

    const allPosts: WordPressNormalizedPost[] = [];
    const statsByType = new Map<
      string,
      {
        totalAvailable: number;
        retrieved: number;
        newCandidates: number;
        skippedExisting: number;
        skippedWithoutCanonical: number;
        inserted: number;
        duplicate: number;
        error: number;
      }
    >();

    const ensureStats = (type: string) => {
      const key = normalizeContentType(type || 'posts');
      if (!statsByType.has(key)) {
        statsByType.set(key, {
          totalAvailable: 0,
          retrieved: 0,
          newCandidates: 0,
          skippedExisting: 0,
          skippedWithoutCanonical: 0,
          inserted: 0,
          duplicate: 0,
          error: 0,
        });
      }
      return statsByType.get(key)!;
    };

    let maxLimitReached = false;
    let maxLimitValue = 1000;
    try {
      const {
        posts: rawPosts,
        totalsByType,
        wasTruncated,
        maxItems,
      } = await wpService.fetchAllContentByTypes(contentTypes, { perPage, maxItems: 1000 });

      maxLimitReached = wasTruncated;
      maxLimitValue = maxItems;

      Object.entries(totalsByType).forEach(([type, total]) => {
        ensureStats(type).totalAvailable = total;
      });

      const normalizedRaw = normalizeWordPressRestPosts(rawPosts);
      normalizedRaw.forEach(post => {
        const type = normalizeContentType(post.post_type ?? 'posts');
        ensureStats(type).retrieved += 1;
      });

      allPosts.push(...normalizedRaw);
    } catch (error) {
      console.error('Failed to fetch WordPress content:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'WordPressコンテンツの取得中にエラーが発生しました',
      };
    }

    const { data: existingAnnotations, error: existingError } = await supabaseClient
      .from('content_annotations')
      .select('canonical_url, wp_post_id, wp_post_title')
      .eq('user_id', userId)
      .not('canonical_url', 'is', null);

    if (existingError) {
      return { success: false, error: '既存アノテーション取得エラー: ' + existingError.message };
    }

    const existingUrls = new Set<string>();
    const existingPostIds = new Set<number>();
    const existingTitleMap = new Map<string, boolean>();

    (existingAnnotations ?? []).forEach(annotation => {
      const canonicalTrimmed = annotation.canonical_url?.trim();
      if (canonicalTrimmed) {
        existingUrls.add(canonicalTrimmed);
        const hasTitle =
          typeof annotation.wp_post_title === 'string' && annotation.wp_post_title.trim().length > 0;
        existingTitleMap.set(canonicalTrimmed, hasTitle);
      }
      if (annotation.wp_post_id !== null && annotation.wp_post_id !== undefined) {
        existingPostIds.add(annotation.wp_post_id);
      }
    });

    const maxAllowed = 1000;
    if (allPosts.length > maxAllowed) {
      maxLimitReached = true;
      maxLimitValue = maxAllowed;
    }

    const normalized = allPosts.slice(0, maxAllowed);

    const candidates: WordPressNormalizedPost[] = [];
    const skipped: WordPressNormalizedPost[] = [];

    normalized.forEach(post => {
      const canonical = post.canonical_url?.trim();
      const hasCanonical = canonical && canonical.length > 0;
      const wpPostId =
        typeof post.id === 'number' ? post.id : Number.isFinite(Number(post.id)) ? Number(post.id) : null;
      const isDuplicateUrl = hasCanonical ? existingUrls.has(canonical) : false;
      const isDuplicateId = wpPostId !== null ? existingPostIds.has(wpPostId) : false;

      if (!hasCanonical || isDuplicateUrl || isDuplicateId) {
        skipped.push(post);
        const type = normalizeContentType(post.post_type ?? 'posts');
        const stats = ensureStats(type);
        if (!hasCanonical) {
          stats.skippedWithoutCanonical += 1;
        }
        if (isDuplicateUrl || isDuplicateId) {
          stats.duplicate += 1;
        }
        return;
      }

      candidates.push(post);
      const type = normalizeContentType(post.post_type ?? 'posts');
      const stats = ensureStats(type);
      stats.newCandidates += 1;
    });

    const toInsert = candidates.map(post => ({
      user_id: userId,
      wp_post_id:
        typeof post.id === 'number'
          ? post.id
          : Number.isFinite(Number(post.id))
            ? Number(post.id)
            : null,
      wp_post_title: post.title ?? null,
      canonical_url: post.canonical_url?.trim() ?? null,
      wp_post_type: post.post_type ?? null,
      wp_categories: post.categories ?? null,
      wp_excerpt: post.excerpt ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    let inserted = 0;
    const titlesBackfilled: string[] = [];

    if (toInsert.length > 0) {
      const { data: insertedRows, error: insertError } = await supabaseClient
        .from('content_annotations')
        .insert(toInsert)
        .select('canonical_url, wp_post_title');

      if (insertError) {
        return { success: false, error: insertError.message };
      }

      inserted = insertedRows?.length ?? 0;

      const needBackfill = insertedRows?.filter(
        row => !row.wp_post_title || row.wp_post_title.trim().length === 0
      );
      if (needBackfill && needBackfill.length > 0) {
        const { data: updated } = await supabaseClient
          .from('content_annotations')
          .update({ wp_post_title: 'タイトル未設定' })
          .in(
            'canonical_url',
            needBackfill
              .map(row => row.canonical_url?.trim())
              .filter((url): url is string => Boolean(url && url.length > 0))
          )
          .select('canonical_url');
        titlesBackfilled.push(...(updated?.map(row => row.canonical_url ?? '') ?? []));
      }
    }

    candidates.forEach(post => {
      const type = normalizeContentType(post.post_type ?? 'posts');
      const stats = ensureStats(type);
      stats.inserted += 1;
    });

    skipped.forEach(post => {
      const type = normalizeContentType(post.post_type ?? 'posts');
      const stats = ensureStats(type);
      if (post.canonical_url?.trim()) {
        stats.skippedExisting += 1;
      } else {
        stats.skippedWithoutCanonical += 1;
      }
    });

    const statsByTypeSerialized = Array.from(statsByType.entries()).reduce<
      Record<
        string,
        {
          totalAvailable: number;
          retrieved: number;
          newCandidates: number;
          skippedExisting: number;
          skippedWithoutCanonical: number;
          inserted: number;
          duplicate: number;
          error: number;
        }
      >
    >((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});

    revalidatePath('/wordpress-import');
    revalidatePath('/analytics');

    return {
      success: true,
      data: {
        totalPosts: allPosts.length,
        newPosts: candidates.length,
        skippedExistingPosts: skipped.filter(post => {
          const canonical = post.canonical_url?.trim();
          const wpPostId =
            typeof post.id === 'number'
              ? post.id
              : Number.isFinite(Number(post.id))
                ? Number(post.id)
                : null;
          return (canonical && existingUrls.has(canonical)) || (wpPostId !== null && existingPostIds.has(wpPostId));
        }).length,
        skippedWithoutCanonical: skipped.filter(post => !post.canonical_url?.trim()).length,
        insertedPosts: inserted,
        duplicatePosts: skipped.filter(post => {
          const canonical = post.canonical_url?.trim();
          const wpPostId =
            typeof post.id === 'number'
              ? post.id
              : Number.isFinite(Number(post.id))
                ? Number(post.id)
                : null;
          return (canonical && existingUrls.has(canonical)) || (wpPostId !== null && existingPostIds.has(wpPostId));
        }).length,
        errorPosts: 0,
        existingContentTotal: existingUrls.size,
        contentTypes: contentTypes,
        statsByType: statsByTypeSerialized,
        maxLimitReached,
        maxLimitValue,
        backfilledTitles: titlesBackfilled.length,
      },
    };
  } catch (error) {
    console.error('[wordpress-import] bulk import failed', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'インポート処理中にエラーが発生しました',
    };
  }
}
