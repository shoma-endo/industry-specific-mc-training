import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';
import { GoogleSearchConsoleService } from '@/server/services/googleSearchConsoleService';
import type { GscCredential } from '@/types/gsc';

const supabaseService = new SupabaseService();
const gscService = new GoogleSearchConsoleService();

const ACCESS_TOKEN_SAFETY_MARGIN_MS = 60 * 1000; // 1 minute

type CredentialWithActiveToken = GscCredential & {
  accessToken: string;
  accessTokenExpiresAt: string;
};

const hasReusableAccessToken = (
  credential: GscCredential
): credential is CredentialWithActiveToken => {
  if (!credential.accessToken || !credential.accessTokenExpiresAt) {
    return false;
  }
  const expiresAtMs = new Date(credential.accessTokenExpiresAt).getTime();
  return expiresAtMs - Date.now() > ACCESS_TOKEN_SAFETY_MARGIN_MS;
};

const ensureAccessToken = async (userId: string, credential: GscCredential): Promise<string> => {
  if (hasReusableAccessToken(credential)) {
    return credential.accessToken;
  }
  const refreshed = await gscService.refreshAccessToken(credential.refreshToken);
  const expiresAt = refreshed.expiresIn
    ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()
    : null;
  await supabaseService.updateGscCredential(userId, {
    accessToken: refreshed.accessToken,
    accessTokenExpiresAt: expiresAt,
    scope: refreshed.scope ?? null,
  });
  return refreshed.accessToken;
};

export async function GET(request: NextRequest) {
  const liffAccessToken = request.cookies.get('line_access_token')?.value;
  const refreshToken = request.cookies.get('line_refresh_token')?.value;

  if (!liffAccessToken) {
    return NextResponse.json({ success: false, error: 'LINE認証が必要です' }, { status: 401 });
  }

  const authResult = await authMiddleware(liffAccessToken, refreshToken);
  if (authResult.error || !authResult.userId) {
    return NextResponse.json(
      { success: false, error: authResult.error || 'ユーザー認証に失敗しました' },
      { status: 401 }
    );
  }

  const credential = await supabaseService.getGscCredentialByUserId(authResult.userId);
  if (!credential) {
    return NextResponse.json(
      { success: false, error: 'Google Search Consoleが未接続です' },
      { status: 404 }
    );
  }

  try {
    const accessToken = await ensureAccessToken(authResult.userId, credential);
    const sites = await gscService.listSites(accessToken);
    await supabaseService.updateGscCredential(authResult.userId, {
      lastSyncedAt: new Date().toISOString(),
    });
    return NextResponse.json({ success: true, data: sites });
  } catch (error) {
    console.error('Failed to fetch Google Search Console properties', error);
    return NextResponse.json(
      { success: false, error: 'プロパティ一覧の取得に失敗しました' },
      { status: 502 }
    );
  }
}
