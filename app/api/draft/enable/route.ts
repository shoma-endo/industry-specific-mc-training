import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Sanity Studio からの認証トークンを確認
  const token = searchParams.get('token');
  const redirectTo = searchParams.get('redirect') || '/';

  // 環境変数のwebhook secretと照合
  if (token !== process.env.SANITY_WEBHOOK_SECRET) {
    return new Response('Invalid token', { status: 401 });
  }

  // Draft Mode を有効化
  (await draftMode()).enable();

  // 指定されたページにリダイレクト
  redirect(redirectTo);
}
