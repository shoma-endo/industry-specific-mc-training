import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { env } from '@/env';

/**
 * LINE OAuth state生成エンドポイント
 * セキュアなstate値を生成し、HttpOnly Cookieとして設定
 */
export async function GET() {
  try {
    // セキュアなランダムstate生成（32バイト = 64文字の16進数）
    const state = randomBytes(32).toString('hex');
    const nonce = randomBytes(32).toString('hex');

    // Cookieストアを取得
    const cookieStore = await cookies();

    // HttpOnly + Secure + SameSite=Lax でstate保存
    cookieStore.set('line_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10分間有効
      path: '/',
    });

    // nonce（使い捨てトークン）も保存
    cookieStore.set('line_oauth_nonce', nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });

    // LINE OAuth認証URLを構築
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: env.LINE_CHANNEL_ID,
      redirect_uri: `${env.NEXT_PUBLIC_SITE_URL}/api/line/callback`,
      state,
      scope: 'profile openid email',
    });

    const authUrl = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('LINE OAuth Init Error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize OAuth' },
      { status: 500 }
    );
  }
}
