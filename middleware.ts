import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getUserRole, isAdmin } from '@/lib/auth-utils';

// 管理者権限が必要なパスの定義
const ADMIN_REQUIRED_PATHS = [
  '/setup',
  '/business-info', 
  '/debug',
  '/studio'
] as const;

// 認証不要なパスの定義
const PUBLIC_PATHS = [
  '/login',
  '/unauthorized',
  '/',
  '/landingPage'
] as const;

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  
  // パフォーマンス向上のためのログ
  const startTime = Date.now();
  
  try {
    // 🔍 1. 公開パスかチェック
    if (isPublicPath(pathname)) {
      logMiddleware(pathname, 'PUBLIC_PATH', Date.now() - startTime);
      return NextResponse.next();
    }

    // 🔍 2. Sanityプレビュー用の例外処理
    if (pathname.startsWith('/landingPage') && searchParams.get('userId')) {
      logMiddleware(pathname, 'SANITY_PREVIEW', Date.now() - startTime);
      return NextResponse.next();
    }

    // 🔍 3. アクセストークンの取得
    const accessToken = request.cookies.get('line_access_token')?.value;
    const refreshToken = request.cookies.get('line_refresh_token')?.value;
    
    if (!accessToken) {
      logMiddleware(pathname, 'NO_ACCESS_TOKEN', Date.now() - startTime);
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // 🔍 4. ユーザーロールの取得（キャッシュ考慮）
    const userRole = await getUserRoleWithCache(accessToken, refreshToken);
    
    if (!userRole) {
      logMiddleware(pathname, 'INVALID_TOKEN', Date.now() - startTime);
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // 🔍 5. 管理者権限チェック
    if (requiresAdminAccess(pathname)) {
      if (!isAdmin(userRole)) {
        logMiddleware(pathname, 'INSUFFICIENT_PERMISSIONS', Date.now() - startTime, userRole);
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }
    }

    // 🔍 6. 成功時のレスポンス
    logMiddleware(pathname, 'SUCCESS', Date.now() - startTime, userRole);
    
    // レスポンスヘッダーにユーザー情報を付与（オプション）
    const response = NextResponse.next();
    response.headers.set('x-user-role', userRole);
    
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

async function getUserRoleWithCache(accessToken: string, refreshToken?: string) {
  const cacheKey = accessToken.substring(0, 20); // セキュリティのため一部のみ使用
  const cached = roleCache.get(cacheKey);
  
  // キャッシュが有効かチェック
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.role as 'user' | 'admin';
  }
  
  try {
    const role = await getUserRole(accessToken);
    
    if (role) {
      // キャッシュに保存
      roleCache.set(cacheKey, { role, timestamp: Date.now() });
      
      // メモリリーク防止：古いキャッシュを削除
      if (roleCache.size > 1000) {
        const oldestKey = roleCache.keys().next().value;
        if (oldestKey) {
          roleCache.delete(oldestKey);
        }
      }
    }
    
    return role;
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
    console.log(`[Middleware] ${pathname} | ${result} | ${duration}ms${userRole ? ` | ${userRole}` : ''}`);
  }
  
  // プロダクション環境では構造化ログ
  if (process.env.NODE_ENV === 'production' && (result === 'ERROR' || result === 'INSUFFICIENT_PERMISSIONS')) {
    console.warn(JSON.stringify({
      type: 'middleware_access',
      pathname,
      result,
      duration,
      userRole,
      timestamp: new Date().toISOString(),
    }));
  }
}
