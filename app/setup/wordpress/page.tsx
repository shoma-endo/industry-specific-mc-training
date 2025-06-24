import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import WordPressSettingsForm from '@/components/WordPressSettingsForm';
import { getWordPressSettings } from '@/server/handler/actions/sanity.action';

export const dynamic = 'force-dynamic';

export default async function WordPressSetupPage() {
  const cookieStore = await cookies();
  const liffAccessToken = cookieStore.get('line_access_token')?.value;
  
  if (!liffAccessToken) {
    redirect('/login');
  }

  // 既存のWordPress設定を取得
  let existingWordPressSettings = null;
  try {
    existingWordPressSettings = await getWordPressSettings(liffAccessToken);
  } catch {
  }

  return (
    <WordPressSettingsForm 
      liffAccessToken={liffAccessToken}
      existingSettings={existingWordPressSettings}
    />
  );
}