import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Sanityプレビュー用の例外 (userIdがある場合は認証不要)
  if (pathname.startsWith('/landingPage') && searchParams.get('userId')) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
      ここで制御対象のパスを指定（必要に応じて調整可能）
      例:
      "/((?!_next|favicon.ico|api|studio|static).*)"
    */
    "/((?!api|studio|_next|favicon.ico).*)",
  ],
};
