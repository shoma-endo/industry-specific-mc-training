import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAdmin, isUnavailable, getUserRoleWithRefresh } from '@/authUtils';
import { hasPaidFeatureAccess, type UserRole } from '@/types/user';

const ADMIN_REQUIRED_PATHS = ['/admin'] as const;
const PAID_FEATURE_REQUIRED_PATHS = ['/setup', '/analytics'] as const;

// 認証不要なパスの定義
const PUBLIC_PATHS = ['/login', '/unauthorized', '/', '/home', '/privacy'] as const;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  try {
    // 🔍 1. 公開パスかチェック（ただし、ログイン済みユーザーの場合はホーム画面でも権限チェックを実行）
    if (isPublicPath(pathname)) {
      // ホーム画面は完全に公開扱いとし、ミドルウェア側で外部サービスを呼び出さない
      return NextResponse.next();
    }

    // 🔍 3. アクセストークンとリフレッシュトークンの取得
    const accessToken = request.cookies.get('line_access_token')?.value;
    const refreshToken = request.cookies.get('line_refresh_token')?.value;

    if (!accessToken) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // 🔍 4. ユーザーロールの取得（リフレッシュトークン対応キャッシュ考慮）
    const authResult = await getUserRoleWithCacheAndRefresh(accessToken, refreshToken).catch(
      error => {
        console.error('[Middleware] Error in getUserRoleWithCacheAndRefresh:', error);
        return { role: null, needsReauth: true };
      }
    );

    if (!authResult.role) {
      if ('needsReauth' in authResult && authResult.needsReauth) {
        // クッキーをクリアしてログインページにリダイレクト
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.delete('line_access_token');
        response.cookies.delete('line_refresh_token');
        return response;
      }

      return NextResponse.redirect(new URL('/login', request.url));
    }

    // 🔍 5. unavailableユーザーのアクセス制限チェック
    if (isUnavailable(authResult.role)) {
      // 既に/unavailableページにいる場合はそのまま通す
      if (pathname === '/unavailable') {
        return NextResponse.next();
      }
      // その他のページへのアクセスは/unavailableにリダイレクト
      return NextResponse.redirect(new URL('/unavailable', request.url));
    }

    if (requiresPaidFeatureAccess(pathname) && !hasPaidFeatureAccess(authResult.role)) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // 🔍 6. 管理者権限チェック
    if (requiresAdminAccess(pathname)) {
      if (!isAdmin(authResult.role)) {
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }
    }

    // 🔍 7. 成功時のレスポンス
    // レスポンスヘッダーにユーザー情報を付与（オプション）
    const response = NextResponse.next();
    response.headers.set('x-user-role', authResult.role);

    // 新しいトークンがある場合はクッキーを更新
    if ('newAccessToken' in authResult && authResult.newAccessToken) {
      response.cookies.set('line_access_token', authResult.newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30日
      });
    }

    if ('newRefreshToken' in authResult && authResult.newRefreshToken) {
      response.cookies.set('line_refresh_token', authResult.newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 90 * 24 * 60 * 60, // 90日
      });
    }

    return response;
  } catch (error) {
    // 🚨 エラーハンドリング
    console.error('[Middleware] Unexpected error:', {
      pathname,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.redirect(new URL('/login', request.url));
  }
}

// 🔧 ヘルパー関数
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(path => {
    // TypeScriptのエラー回避のため、明示的な比較は削除してstartsWithのみにする
    // pathは '/login', '/home' などであり、 '/' は含まれていないため startsWith で十分
    return pathname.startsWith(path);
  });
}

function requiresAdminAccess(pathname: string): boolean {
  return ADMIN_REQUIRED_PATHS.some(path => pathname.startsWith(path));
}

function requiresPaidFeatureAccess(pathname: string): boolean {
  return PAID_FEATURE_REQUIRED_PATHS.some(path => pathname.startsWith(path));
}

// 🚀 パフォーマンス最適化：メモリキャッシュ
const roleCache = new Map<string, { role: UserRole; timestamp: number }>();
const CACHE_TTL = 30 * 1000; // 30秒キャッシュ（権限変更の反映を早くするため）

async function getUserRoleWithCacheAndRefresh(accessToken: string, refreshToken?: string) {
  const cacheKey = accessToken.substring(0, 20); // セキュリティのため一部のみ使用
  const cached = roleCache.get(cacheKey);

  // キャッシュが有効かチェック
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { role: cached.role };
  }

  try {
    if (!getUserRoleWithRefresh || typeof getUserRoleWithRefresh !== 'function') {
      console.error('[Middleware] getUserRoleWithRefresh is not a function');
      return { role: null, needsReauth: true };
    }

    const result = await getUserRoleWithRefresh(accessToken, refreshToken);

    if (result.role) {
      // キャッシュに保存（新しいトークンがある場合はそれでキャッシュ）
      const tokenForCache = result.newAccessToken || accessToken;
      const cacheKeyForNewToken = tokenForCache.substring(0, 20);
      roleCache.set(cacheKeyForNewToken, { role: result.role, timestamp: Date.now() });

      // 古いキャッシュを削除
      if (result.newAccessToken && cacheKey !== cacheKeyForNewToken) {
        roleCache.delete(cacheKey);
      }

      // メモリリーク防止：古いキャッシュを削除
      if (roleCache.size > 1000) {
        const oldestKey = roleCache.keys().next().value;
        if (oldestKey) {
          roleCache.delete(oldestKey);
        }
      }
    }

    return result;
  } catch (error) {
    // キャッシュを削除
    roleCache.delete(cacheKey);
    throw error;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and API routes
     */
    '/((?!_next/static|_next/image|_next|_vercel|_document|_not-found|_error|favicon.ico|api/).*)',
  ],
};
