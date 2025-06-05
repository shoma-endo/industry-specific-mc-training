import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth.middleware'; // authMiddleware のインポートを戻す
import { getSanityClient } from '@/lib/utils';
import { landingPageByUserAndSlugQuery } from '@/lib/queries';
import { LandingPageData } from '@/types/sanity';
import { WordPressService, WordPressComAuth } from '@/server/services/wordpressService';
import { WordPressExportData } from '@/types/wordpress';
import { convertSanityToWordPress } from '@/lib/wordpress-converter';

// リクエストボディのバリデーションスキーマに liffAccessToken を戻す
const exportRequestSchema = z.object({
  liffAccessToken: z.string(), // ← この行を元に戻す
  slug: z.string(),
  userId: z.string().optional(), // ★ 追加: userId をスキーマに追加 (任意)
  publishStatus: z.enum(['draft', 'publish']).default('draft'),
  updateExisting: z.boolean().default(false),
  exportType: z.enum(['post', 'page']).default('post'), // ★ 追加: エクスポートタイプ
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = exportRequestSchema.parse(body);

    // liffAccessToken を再度展開
    const {
      liffAccessToken,
      slug,
      userId: requestUserId,
      publishStatus,
      updateExisting,
      exportType, // ★ 追加: exportType を展開
    } = validatedData;

    // LIFF認証チェックを元に戻す
    const authResult = await authMiddleware(liffAccessToken); // authMiddleware を呼び出す
    if (authResult.error || authResult.requiresSubscription || !authResult.userId) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error || '認証またはサブスクリプション、あるいはユーザーIDが必要です',
        },
        { status: 401 }
      );
    }

    // WordPress.com OAuthトークン取得
    const tokenCookieName = process.env.OAUTH_TOKEN_COOKIE_NAME || 'wpcom_oauth_token';
    const accessToken = request.cookies.get(tokenCookieName)?.value;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'WordPress.comのアクセストークンが見つかりません。連携を行ってください。',
          needsWordPressAuth: true,
        },
        { status: 401 }
      );
    }

    const siteId = process.env.WORDPRESS_COM_SITE_ID;
    if (!siteId) {
      console.error('WORDPRESS_COM_SITE_ID is not set in environment variables.');
      return NextResponse.json(
        { success: false, error: 'WordPressサイトIDが設定されていません。' },
        { status: 500 }
      );
    }

    // Sanityからランディングページデータを取得
    const sanityClient = await getSanityClient(liffAccessToken); // liffAccessToken を渡す

    // ★ 変更: リクエストボディのuserIdがあればそれを使い、なければauthResult.userIdをフォールバック
    const targetUserId = requestUserId || authResult.userId;

    // ★★★ デバッグログ追加 ★★★
    console.log('[Export Route] Fetching Sanity data with:');
    console.log('  Slug:', slug);
    console.log('  Target UserID for Sanity Query:', targetUserId);
    if (requestUserId) {
      console.log('    (Using userId from request body)');
    } else {
      console.log('    (Using userId from authMiddleware as fallback)');
    }
    // ★★★ ここまで ★★★

    const landingPageData = await sanityClient.fetch<LandingPageData>(
      landingPageByUserAndSlugQuery,
      { slug, userId: targetUserId } // ★ 変更: targetUserId を使用
    );

    if (!landingPageData) {
      return NextResponse.json(
        { success: false, error: 'ランディングページが見つかりません' },
        { status: 404 }
      );
    }

    // WordPress サービスのインスタンス作成 (OAuth対応)
    const wpAuth: WordPressComAuth = { accessToken, siteId };
    const wordpressService = new WordPressService(wpAuth);

    // Sanity データを WordPress 用に変換
    const wpExportPayload: WordPressExportData = convertSanityToWordPress(landingPageData);
    wpExportPayload.status = publishStatus;
    wpExportPayload.updateExisting = updateExisting;

    // WordPress にエクスポートタイプに応じて処理を分岐
    let exportResult;
    const exportTargetName = exportType === 'page' ? '固定ページ' : '投稿';

    if (exportType === 'page') {
      exportResult = await wordpressService.exportPageToWordPress(wpExportPayload);
    } else {
      exportResult = await wordpressService.exportPostToWordPress(wpExportPayload);
    }

    if (!exportResult.success || !exportResult.data) {
      return NextResponse.json(
        {
          success: false,
          error:
            exportResult.error || `WordPressへの${exportTargetName}エクスポートに失敗しました。`,
        },
        { status: exportResult.error?.toLowerCase().includes('token') ? 401 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        updateExisting && exportResult.data.status === 'publish'
          ? `WordPressの既存${exportTargetName}を更新しました（ID: ${exportResult.data.ID}）`
          : `WordPressに新しい${exportTargetName}を作成/更新しました`,
      data: {
        postId: exportResult.data.ID,
        postUrl: exportResult.data.link,
        title: exportResult.data.title,
        slug: exportResult.data.slug || slug,
        status: exportResult.data.status,
        action: updateExisting ? 'updated' : 'created',
        exportType: exportType,
      },
      postUrl: exportResult.postUrl,
    });
  } catch (error) {
    console.error('WordPress export error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'リクエストデータが無効です', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'エクスポート処理中に予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
