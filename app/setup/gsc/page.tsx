import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import GscSetupClient from '@/components/GscSetupClient';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';
import { toGscConnectionStatus } from '@/server/lib/gscStatus';

export const dynamic = 'force-dynamic';

const supabaseService = new SupabaseService();

export default async function GscSetupPage() {
  const cookieStore = await cookies();
  const liffAccessToken = cookieStore.get('line_access_token')?.value;
  const refreshToken = cookieStore.get('line_refresh_token')?.value;
  const isOauthConfigured = Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      process.env.GOOGLE_SEARCH_CONSOLE_REDIRECT_URI
  );

  if (!liffAccessToken) {
    redirect('/login');
  }

  const authResult = await authMiddleware(liffAccessToken, refreshToken);
  if (authResult.error || !authResult.userId) {
    redirect('/login');
  }

  const credential = await supabaseService.getGscCredentialByUserId(authResult.userId);
  const initialStatus = toGscConnectionStatus(credential);

  return <GscSetupClient initialStatus={initialStatus} isOauthConfigured={isOauthConfigured} />;
}
