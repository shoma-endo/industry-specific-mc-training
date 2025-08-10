import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { userService } from '@/server/services/userService';
import { LineAuthService } from '@/server/services/lineAuthService';

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('line_access_token')?.value;
  const refreshToken = cookieStore.get('line_refresh_token')?.value;

  if (!accessToken) {
    return NextResponse.json({ userId: null, user: null });
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

    // トークンがリフレッシュされたか、または元のトークンが有効
    const tokenToUse = authResult.newAccessToken || accessToken;
    const user = await userService.getUserFromLiffToken(tokenToUse);

    // レスポンスを一度だけ作成（最小限のユーザー情報を含める）
    const response = NextResponse.json({
      userId: user?.id || null,
      user: user
        ? {
            id: user.id,
            fullName: user.fullName ?? null,
            role: user.role,
            lineDisplayName: user.lineDisplayName,
            linePictureUrl: user.linePictureUrl ?? null,
          }
        : null,
      tokenRefreshed: !!authResult.newAccessToken, // newAccessToken があれば true
    });

    // 新しいトークンが取得された場合、クッキーを更新
    if (authResult.newAccessToken) {
      response.cookies.set('line_access_token', authResult.newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict', // 'lax' から 'strict' に変更を推奨（セキュリティ向上）
        path: '/', // path を追加
        maxAge: 60 * 60 * 24 * 3, // 3日
      });

      if (authResult.newRefreshToken) {
        response.cookies.set('line_refresh_token', authResult.newRefreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict', // 'lax' から 'strict' に変更を推奨
          path: '/', // path を追加
          maxAge: 60 * 60 * 24 * 30, // 30日
        });
      }
    }
    return response;
  } catch (error) {
    console.error('[User Current API] Error:', error);
    return NextResponse.json({ userId: null, user: null });
  }
}
