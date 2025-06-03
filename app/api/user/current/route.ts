import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { userService } from '@/server/services/userService';
import { LineAuthService } from '@/server/services/lineAuthService';

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('line_access_token')?.value;
  const refreshToken = cookieStore.get('line_refresh_token')?.value;

  if (!accessToken) {
    return NextResponse.json({ userId: null });
  }

  try {
    const lineAuthService = new LineAuthService();

    // トークンの検証とリフレッシュを試行
    const authResult = await lineAuthService.verifyLineTokenWithRefresh(accessToken, refreshToken);

    if (!authResult.isValid) {
      // 再認証が必要な場合
      if (authResult.needsReauth) {
        // クッキーをクリア
        const response = NextResponse.json({ userId: null, needsReauth: true });
        response.cookies.delete('line_access_token');
        response.cookies.delete('line_refresh_token');
        return response;
      }
      return NextResponse.json({ userId: null });
    }

    // 新しいトークンが取得された場合、クッキーを更新
    let currentAccessToken = accessToken;
    if (authResult.newAccessToken) {
      currentAccessToken = authResult.newAccessToken;

      const response = NextResponse.json({ userId: null }); // 一時的なレスポンス

      // 新しいアクセストークンをクッキーに設定
      response.cookies.set('line_access_token', authResult.newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 30, // 30分
      });

      // 新しいリフレッシュトークンが提供された場合
      if (authResult.newRefreshToken) {
        response.cookies.set('line_refresh_token', authResult.newRefreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 60 * 60 * 24 * 30, // 30日
        });
      }
    }

    const user = await userService.getUserFromLiffToken(currentAccessToken);

    if (authResult.newAccessToken) {
      const response = NextResponse.json({ userId: user?.id || null, tokenRefreshed: true });

      // 新しいトークンでクッキーを更新
      response.cookies.set('line_access_token', authResult.newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 30, // 30分
      });

      if (authResult.newRefreshToken) {
        response.cookies.set('line_refresh_token', authResult.newRefreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 60 * 60 * 24 * 30, // 30日
        });
      }

      return response;
    }

    return NextResponse.json({ userId: user?.id || null });
  } catch (error) {
    console.error('[User Current API] Error:', error);
    return NextResponse.json({ userId: null });
  }
}
