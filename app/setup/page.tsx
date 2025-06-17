import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getWordPressSettings } from '@/server/handler/actions/sanity.action';
import SetupDashboard from '@/components/SetupDashboard';
import { getSanityProject } from '@/server/handler/actions/sanity.action';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  const cookieStore = await cookies();
  const liffAccessToken = cookieStore.get('line_access_token')?.value;

  if (!liffAccessToken) {
    redirect('/login');
  }

  // Sanity設定をチェック
  let hasSanitySettings = false;
  let sanityProjectId = null;
  try {
    const sanityProject = await getSanityProject(liffAccessToken);
    // project_idが存在し、空文字列でない場合のみ設定済みと判定
    hasSanitySettings = !!(
      sanityProject &&
      sanityProject.project_id &&
      sanityProject.project_id.trim() !== ''
    );
    sanityProjectId = sanityProject?.project_id || null;
  } catch (error) {
    console.log('Sanity設定の取得でエラー:', error);
  }

  // WordPress設定をチェック（WordPress.comとセルフホスト両対応）
  let hasWordPressSettings = false;
  let wordpressSettings = null;
  try {
    wordpressSettings = await getWordPressSettings(liffAccessToken);
    hasWordPressSettings = !!(
      (
        wordpressSettings &&
        (wordpressSettings.wpSiteId || // WordPress.com
          wordpressSettings.wpSiteUrl)
      ) // セルフホスト
    );
  } catch (error) {
    console.log('WordPress設定の取得でエラー:', error);
  }

  return (
    <SetupDashboard
      sanitySettings={{
        hasSettings: hasSanitySettings,
        projectId: sanityProjectId,
      }}
      wordpressSettings={{
        hasSettings: hasWordPressSettings,
        type: wordpressSettings?.wpType || 'wordpress_com',
        ...(wordpressSettings?.wpSiteId && { siteId: wordpressSettings.wpSiteId }),
        ...(wordpressSettings?.wpSiteUrl && { siteUrl: wordpressSettings.wpSiteUrl }),
      }}
    />
  );
}
