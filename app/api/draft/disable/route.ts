import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';

export async function GET() {
  // Draft Mode を無効化
  (await draftMode()).disable();

  // ホームページにリダイレクト
  redirect('/');
}
