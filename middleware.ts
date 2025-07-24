import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getUserRoleWithRefresh, isAdmin } from '@/lib/auth-utils';

// 管理者権限が必要なパスの定義
const ADMIN_REQUIRED_PATHS = ['/setup', '/admin'] as const;

// 認証不要なパスの定義
const PUBLIC_PATHS = ['/login', '/unauthorized', '/', '/landingPage'] as const;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // パフォーマンス向上のためのログ
  const startTime = Date.now();

  try {
    // 🔍 1. 公開パスかチェック
    if (isPublicPath(pathname)) {
      logMiddleware(pathname, 'PUBLIC_PATH', Date.now() - startTime);
      return NextResponse.next();
    }

    // 🔍 3. アクセストークンとリフレッシュトークンの取得
    const accessToken = request.cookies.get('line_access_token')?.value;
    const refreshToken = request.cookies.get('line_refresh_token')?.value;

    if (!accessToken) {
      logMiddleware(pathname, 'NO_ACCESS_TOKEN', Date.now() - startTime);
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // 🔍 4. ユーザーロールの取得（リフレッシュトークン対応キャッシュ考慮）
    const authResult = await getUserRoleWithCacheAndRefresh(accessToken, refreshToken);

    if (!authResult.role) {
      if (authResult.needsReauth) {
        logMiddleware(pathname, 'NEEDS_REAUTH', Date.now() - startTime);
        // クッキーをクリアしてログインページにリダイレクト
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.delete('line_access_token');
        response.cookies.delete('line_refresh_token');
        return response;
      }
      
      logMiddleware(pathname, 'INVALID_TOKEN', Date.now() - startTime);
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // 🔍 5. 管理者権限チェック
    if (requiresAdminAccess(pathname)) {
      if (!isAdmin(authResult.role)) {
        logMiddleware(pathname, 'INSUFFICIENT_PERMISSIONS', Date.now() - startTime, authResult.role);
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }
    }

    // 🔍 6. 成功時のレスポンス
    logMiddleware(pathname, 'SUCCESS', Date.now() - startTime, authResult.role);

    // レスポンスヘッダーにユーザー情報を付与（オプション）
    const response = NextResponse.next();
    response.headers.set('x-user-role', authResult.role);

    // 新しいトークンがある場合はクッキーを更新
    if (authResult.newAccessToken) {
      response.cookies.set('line_access_token', authResult.newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30日
      });
      logMiddleware(pathname, 'TOKEN_REFRESHED', Date.now() - startTime, authResult.role);
    }

    if (authResult.newRefreshToken) {
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

    logMiddleware(pathname, 'ERROR', Date.now() - startTime);
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

// 🔧 ヘルパー関数
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(path => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  });
}

function requiresAdminAccess(pathname: string): boolean {
  return ADMIN_REQUIRED_PATHS.some(path => pathname.startsWith(path));
}

// 🚀 パフォーマンス最適化：メモリキャッシュ
const roleCache = new Map<string, { role: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5分キャッシュ

async function getUserRoleWithCacheAndRefresh(accessToken: string, refreshToken?: string) {
  const cacheKey = accessToken.substring(0, 20); // セキュリティのため一部のみ使用
  const cached = roleCache.get(cacheKey);

  // キャッシュが有効かチェック
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { role: cached.role as 'user' | 'admin' };
  }

  try {
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

// 📊 ログ出力関数
function logMiddleware(
  pathname: string,
  result: string,
  duration: number,
  userRole?: string | null
) {
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[Middleware] ${pathname} | ${result} | ${duration}ms${userRole ? ` | ${userRole}` : ''}`
    );
  }

  // プロダクション環境では構造化ログ
  if (
    process.env.NODE_ENV === 'production' &&
    (result === 'ERROR' || result === 'INSUFFICIENT_PERMISSIONS')
  ) {
    console.warn(
      JSON.stringify({
        type: 'middleware_access',
        pathname,
        result,
        duration,
        userRole,
        timestamp: new Date().toISOString(),
      })
    );
  }
}
