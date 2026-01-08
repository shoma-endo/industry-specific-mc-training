import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getWordPressSettings } from '@/server/actions/wordpress.actions';
import SetupDashboard from '@/components/SetupDashboard';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';
import { toGscConnectionStatus } from '@/server/lib/gsc-status';

export const dynamic = 'force-dynamic';

const supabaseService = new SupabaseService();

export default async function SetupPage() {
  const cookieStore = await cookies();
  const liffAccessToken = cookieStore.get('line_access_token')?.value;
  const refreshToken = cookieStore.get('line_refresh_token')?.value;

  if (!liffAccessToken) {
    redirect('/login');
  }

  const authResult = await authMiddleware(liffAccessToken, refreshToken);
  if (authResult.error || !authResult.userId) {
    redirect('/login');
  }
  // Setup page should be accessible to owners at all times
  // for configuration and error resolution (e.g., GSC re-auth).

  // WordPress設定をチェック（WordPress.comとセルフホスト両対応）
  let hasWordPressSettings = false;
  let wordpressSettings = null;
  try {
    wordpressSettings = await getWordPressSettings();
    hasWordPressSettings = !!(
      (
        wordpressSettings &&
        (wordpressSettings.wpSiteId || // WordPress.com
          wordpressSettings.wpSiteUrl)
      ) // セルフホスト
    );
  } catch (error) {
    console.error('[Setup] Failed to fetch WordPress settings:', error);
  }

  const gscCredential = await supabaseService.getGscCredentialByUserId(authResult.userId);
  const gscStatus = toGscConnectionStatus(gscCredential);

  return (
    <SetupDashboard
      wordpressSettings={{
        hasSettings: hasWordPressSettings,
        type: wordpressSettings?.wpType || 'wordpress_com',
        ...(wordpressSettings?.wpSiteId && { siteId: wordpressSettings.wpSiteId }),
        ...(wordpressSettings?.wpSiteUrl && { siteUrl: wordpressSettings.wpSiteUrl }),
      }}
      gscStatus={gscStatus}
    />
  );
}
