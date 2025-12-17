import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import WordPressSettingsForm from '@/components/WordPressSettingsForm';
import { getWordPressSettings } from '@/server/actions/wordpress.actions';
import { authMiddleware } from '@/server/middleware/auth.middleware';

export const dynamic = 'force-dynamic';

export default async function WordPressSetupPage() {
  const cookieStore = await cookies();
  const liffAccessToken = cookieStore.get('line_access_token')?.value;
  const refreshToken = cookieStore.get('line_refresh_token')?.value;

  if (!liffAccessToken) {
    redirect('/login');
  }

  const authResult = await authMiddleware(liffAccessToken, refreshToken);
  if (authResult.error || !authResult.userDetails?.role) {
    redirect('/login');
  }

  // 既存のWordPress設定を取得
  let existingWordPressSettings = null;
  try {
    existingWordPressSettings = await getWordPressSettings();
  } catch {
  }

  return (
    <WordPressSettingsForm
      existingSettings={existingWordPressSettings}
      role={authResult.userDetails.role}
    />
  );
}
