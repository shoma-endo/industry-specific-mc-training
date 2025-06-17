import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import SanitySettingsForm from '@/components/SanitySettingsForm';
import { getSanityProject } from '@/server/handler/actions/sanity.action';

export const dynamic = 'force-dynamic';

export default async function SanitySetupPage() {
  const cookieStore = await cookies();
  const liffAccessToken = cookieStore.get('line_access_token')?.value;
  
  if (!liffAccessToken) {
    redirect('/login');
  }

  // 既存のSanity設定を取得
  let existingSanityProject: {
    id: string;
    user_id: string;
    project_id: string;
    dataset: string;
    created_at: string;
  } | null = null;
  try {
    existingSanityProject = await getSanityProject(liffAccessToken);
  } catch (error) {
    console.log('Sanity設定の取得でエラー:', error);
  }

  return (
    <SanitySettingsForm 
      liffAccessToken={liffAccessToken}
      existingProject={existingSanityProject}
    />
  );
}