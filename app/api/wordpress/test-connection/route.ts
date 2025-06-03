import { NextRequest, NextResponse } from 'next/server';
// import { z } from 'zod';
// import { authMiddleware } from '@/server/middleware/auth.middleware';
import { WordPressService, WordPressComAuth } from '@/server/services/wordpressService';

// リクエストボディのバリデーションスキーマは不要になるためコメントアウトまたは削除
// const testConnectionRequestSchema = z.object({
//   liffAccessToken: z.string(),
// });

export async function POST(request: NextRequest) {
  try {
    // LIFF Access Tokenの検証処理は削除

    // WordPress.com OAuth Tokenの処理はここから
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

    const auth: WordPressComAuth = { accessToken, siteId };
    const wordpressService = new WordPressService(auth);

    const connectionTest = await wordpressService.testConnection();

    if (!connectionTest.success) {
      return NextResponse.json(
        {
          success: false,
          error: connectionTest.error || 'WordPress.comへの接続テストに失敗しました。',
        },
        // トークン関連エラー(例: "Invalid token", "Token expired")の場合401を返すようにする判定を追加
        {
          status:
            connectionTest.error &&
            (connectionTest.error.toLowerCase().includes('token') ||
              connectionTest.error.toLowerCase().includes('invalid_request'))
              ? 401
              : 400,
        }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'WordPress.com接続テストが成功しました',
      siteInfo: connectionTest.data,
    });
  } catch (error) {
    console.error('WordPress connection test error:', error);
    // ZodError のキャッチは不要になる
    // if (error instanceof z.ZodError) {
    //   return NextResponse.json(
    //     { success: false, error: 'リクエストデータが無効です', details: error.errors },
    //     { status: 400 }
    //   );
    // }
    return NextResponse.json(
      { success: false, error: '接続テスト中に予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}
