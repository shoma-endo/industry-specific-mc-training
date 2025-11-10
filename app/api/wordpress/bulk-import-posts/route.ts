import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';
import { buildWordPressServiceFromSettings } from '@/server/services/wordpressContext';
import { normalizeWordPressRestPosts } from '@/server/services/wordpressService';
import { normalizeContentTypes, normalizeContentType } from '@/server/services/wordpressContentTypes';
import type { WordPressNormalizedPost } from '@/types/wordpress';

export async function POST(request: NextRequest) {
  try {

    // 管理者認証
    const authHeader = request.headers.get('authorization');
    const liffAccessToken = authHeader?.replace('Bearer ', '') ?? undefined;
    const authResult = await authMiddleware(liffAccessToken);

    if (authResult.error || !authResult.userId) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error || 'LINE認証に失敗しました。LIFFから再ログインしてください。'
        },
        { status: 401 }
      );
    }

    // ユーザーのWordPress設定を取得
    const supabaseService = new SupabaseService();
    const supabaseClient = supabaseService.getClient();
    const userId = authResult.userId;
    const wpSettings = await supabaseService.getWordPressSettingsByUserId(userId);
    if (!wpSettings) {
      return NextResponse.json(
        { success: false, error: 'WordPress設定が見つかりません。WordPress設定を先に登録してください。' },
        { status: 400 }
      );
    }

    // WordPressサービスを構築
    const buildResult = buildWordPressServiceFromSettings(
      wpSettings,
      name => request.cookies.get(name)?.value
    );

    if (!buildResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: buildResult.message,
          needsWordPressAuth: buildResult.needsWordPressAuth ?? false
        },
        { status: buildResult.reason === 'wordpress_auth_missing' ? 401 : 400 }
      );
    }

    const wpService = buildResult.service;

    const perPage = 100; // WordPress APIの最大値
    let contentTypes = normalizeContentTypes(wpSettings.wpContentTypes);

    if (contentTypes.length === 0) {
      const fetchedTypesResult = await wpService.fetchAvailableContentTypes();
      if (!fetchedTypesResult.success || !Array.isArray(fetchedTypesResult.data)) {
        return NextResponse.json(
          {
            success: false,
            error:
              fetchedTypesResult.error ||
              'WordPressの投稿タイプを取得できませんでした。設定ダッシュボードでWordPress接続設定を確認してください。',
          },
          { status: 502 }
        );
      }

      const autoContentTypes = normalizeContentTypes(fetchedTypesResult.data);
      if (autoContentTypes.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'WordPressの投稿タイプを取得できませんでした。設定ダッシュボードでWordPress接続設定を確認してください。',
          },
          { status: 502 }
        );
      }

      try {
        await supabaseService.updateWordPressContentTypes(userId, autoContentTypes);
        contentTypes = autoContentTypes;
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'WordPress投稿タイプの保存に失敗しました。再度お試しください。',
          },
          { status: 500 }
        );
      }
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
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'WordPressコンテンツの取得中にエラーが発生しました',
        },
        { status: 502 }
      );
    }

    // 既存のcanonical_urlとwp_post_idを取得（重複チェック用）
    const { data: existingAnnotations, error: existingError } = await supabaseClient
      .from('content_annotations')
      .select('canonical_url, wp_post_id, wp_post_title')
      .eq('user_id', userId)
      .not('canonical_url', 'is', null);

    if (existingError) {
      return NextResponse.json(
        { success: false, error: '既存アノテーション取得エラー: ' + existingError.message },
        { status: 500 }
      );
    }

    const existingUrls = new Set<string>();
    const existingPostIds = new Set<number>();
    const existingTitleMap = new Map<string, boolean>();

    (existingAnnotations ?? []).forEach(annotation => {
      const canonicalTrimmed = annotation.canonical_url?.trim();
      if (canonicalTrimmed) {
        existingUrls.add(canonicalTrimmed);
        const hasTitle =
          typeof annotation.wp_post_title === 'string' &&
          annotation.wp_post_title.trim().length > 0;
        existingTitleMap.set(canonicalTrimmed, hasTitle);
      }

      if (typeof annotation.wp_post_id === 'number' && !Number.isNaN(annotation.wp_post_id)) {
        existingPostIds.add(annotation.wp_post_id);
      }
    });

    const existingContentTotal = existingUrls.size;

    // 新規登録対象の記事をフィルタリング（canonical_urlとwp_post_idの両方で重複チェック）
    const knownCanonicalUrls = new Set(existingUrls);
    const knownPostIds = new Set(existingPostIds);

    let skippedExistingPosts = 0;
    let skippedWithoutCanonical = 0;
    const missingTitleUpdates: Array<{ canonical: string; title: string }> = [];

    const newPosts: WordPressNormalizedPost[] = [];

    for (const post of allPosts) {
      const postType = normalizeContentType(post.post_type ?? 'posts');
      const typeStats = ensureStats(postType);

      if (!post.canonical_url) {
        skippedWithoutCanonical++;
        typeStats.skippedWithoutCanonical++;
        continue;
      }

      const canonicalTrimmed = post.canonical_url.trim();
      if (!canonicalTrimmed) {
        skippedWithoutCanonical++;
        typeStats.skippedWithoutCanonical++;
        continue;
      }

      const numericPostId =
        typeof post.id === 'number'
          ? post.id
          : typeof post.id === 'string'
            ? Number.parseInt(post.id, 10)
            : undefined;

      const hasDuplicateId =
        typeof numericPostId === 'number' && !Number.isNaN(numericPostId)
          ? knownPostIds.has(numericPostId)
          : false;
      const hasDuplicateUrl = knownCanonicalUrls.has(canonicalTrimmed);
      if (hasDuplicateId || hasDuplicateUrl) {
        const existingHasTitle = existingTitleMap.get(canonicalTrimmed) ?? false;
        const candidateTitle = typeof post.title === 'string' ? post.title.trim() : '';
        if (!existingHasTitle && candidateTitle.length > 0) {
          missingTitleUpdates.push({ canonical: canonicalTrimmed, title: candidateTitle });
          existingTitleMap.set(canonicalTrimmed, true);
        }

        skippedExistingPosts++;
        typeStats.skippedExisting++;
        continue;
      }

      const normalizedPost: WordPressNormalizedPost = {
        ...post,
        canonical_url: canonicalTrimmed,
        post_type: postType,
      };

      newPosts.push(normalizedPost);
      typeStats.newCandidates++;

      knownCanonicalUrls.add(canonicalTrimmed);
      if (typeof numericPostId === 'number' && !Number.isNaN(numericPostId)) {
        knownPostIds.add(numericPostId);
      }
    }

    // 新規canonical_urlを安全に一括登録（トランザクション管理）
    let insertedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    let updatedTitleCount = 0;

    if (newPosts.length > 0) {
      // 安全のため、バッチサイズを50件に制限
      const batchSize = 50;
      const batches = [];

      for (let i = 0; i < newPosts.length; i += batchSize) {
        batches.push(newPosts.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        const insertData = batch.map(post => ({
          user_id: userId,
          wp_post_id: post.id,
          canonical_url: post.canonical_url,
          wp_post_title: post.title,
          wp_post_type: post.post_type ?? 'posts',
          updated_at: new Date().toISOString()
        }));

        try {
          const { error: insertError } = await supabaseClient
            .from('content_annotations')
            .insert(insertData);

          if (insertError) {
            // UNIQUE制約違反（重複）の場合
            if (insertError.code === '23505') {
              console.warn(`バッチで重複が発生しました（${batch.length}件中）:`, insertError.message);
              for (const post of batch) {
              duplicateCount += 1;
              ensureStats(post.post_type ?? 'posts').duplicate += 1;
              }
            } else {
              console.error('バッチINSERTエラー:', insertError);
              for (const post of batch) {
              errorCount += 1;
              ensureStats(post.post_type ?? 'posts').error += 1;
              }
            }
          } else {
            for (const post of batch) {
            insertedCount += 1;
            ensureStats(post.post_type ?? 'posts').inserted += 1;
            }
          }
        } catch (error) {
          console.error('バッチ処理中に予期しないエラーが発生:', error);
          for (const post of batch) {
          errorCount += 1;
          ensureStats(post.post_type ?? 'posts').error += 1;
        }
      }
    }

    if (missingTitleUpdates.length > 0) {
      for (const update of missingTitleUpdates) {
        const { error: updateError } = await supabaseClient
          .from('content_annotations')
          .update({
            wp_post_title: update.title,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('canonical_url', update.canonical)
          .or('wp_post_title.is.null,wp_post_title.eq.');

        if (updateError) {
          console.error('Failed to backfill wp_post_title:', updateError, update);
          return NextResponse.json(
            {
              success: false,
              error: `既存レコードのタイトル補完に失敗しました: ${updateError.message}`,
            },
            { status: 500 }
          );
        }

        updatedTitleCount += 1;
      }
    }
    }

    const statsByTypeObject = Object.fromEntries(statsByType.entries());

    return NextResponse.json({
      success: true,
      data: {
        totalPosts: allPosts.length,
        newPosts: newPosts.length,
        skippedExistingPosts,
        skippedWithoutCanonical,
        insertedPosts: insertedCount,
        duplicatePosts: duplicateCount,
        errorPosts: errorCount,
        existingContentTotal,
        contentTypes,
        statsByType: statsByTypeObject,
        maxLimitReached,
        maxLimitValue,
        backfilledTitles: updatedTitleCount,
      }
    });

  } catch (error) {
    console.error('Bulk import error:', error);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
