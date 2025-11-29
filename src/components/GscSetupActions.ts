'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';
import { GscService } from '@/server/services/gscService';
import type { GscCredential } from '@/types/gsc';
import { toGscConnectionStatus } from '@/server/lib/gscStatus';
import type { GscSiteEntry } from '@/types/gsc';
import { formatGscPropertyDisplayName } from '@/server/services/gscService';
import { propertyTypeFromUri } from '@/server/lib/gscStatus';

const supabaseService = new SupabaseService();
const gscService = new GscService();

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

const getAuthUserId = async () => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('line_access_token')?.value;
  const refreshToken = cookieStore.get('line_refresh_token')?.value;
  const authResult = await authMiddleware(accessToken, refreshToken);
  if (authResult.error || !authResult.userId) {
    return { error: authResult.error || 'ユーザー認証に失敗しました' };
  }
  return { userId: authResult.userId };
};

export async function fetchGscStatus() {
  const { userId, error } = await getAuthUserId();
  if (error || !userId) {
    return { success: false, error: error || 'ユーザー認証に失敗しました' };
  }
  const credential = await supabaseService.getGscCredentialByUserId(userId);
  const status = toGscConnectionStatus(credential);
  return { success: true, data: status };
}

export async function fetchGscProperties() {
  try {
    const { userId, error } = await getAuthUserId();
    if (error || !userId) {
      return { success: false, error: error || 'ユーザー認証に失敗しました' };
    }

    const credential = await supabaseService.getGscCredentialByUserId(userId);
    if (!credential) {
      return { success: false, error: 'Google Search Consoleが未接続です' };
    }

    const accessToken = await ensureAccessToken(userId, credential);
    const sites = await gscService.listSites(accessToken);
    await supabaseService.updateGscCredential(userId, {
      lastSyncedAt: new Date().toISOString(),
    });
    return { success: true, data: sites as GscSiteEntry[] };
  } catch (error) {
    console.error('[GSC Setup] fetch properties failed', error);
    return { success: false, error: 'プロパティ一覧の取得に失敗しました' };
  }
}

export async function saveGscProperty(params: { propertyUri: string; permissionLevel?: string | null }) {
  try {
    const { userId, error } = await getAuthUserId();
    if (error || !userId) {
      return { success: false, error: error || 'ユーザー認証に失敗しました' };
    }
    const propertyUri = params.propertyUri?.trim();
    if (!propertyUri) {
      return { success: false, error: 'propertyUriは必須です' };
    }
    const credential = await supabaseService.getGscCredentialByUserId(userId);
    if (!credential) {
      return { success: false, error: 'Google Search Consoleが未接続です' };
    }

    const propertyType = propertyTypeFromUri(propertyUri);
    const permissionLevel =
      typeof params.permissionLevel === 'string' ? params.permissionLevel : credential.permissionLevel;
    const verified = permissionLevel ? permissionLevel !== 'siteUnverifiedUser' : credential.verified ?? null;

    await supabaseService.updateGscCredential(userId, {
      propertyUri,
      propertyType,
      propertyDisplayName: formatGscPropertyDisplayName(propertyUri),
      permissionLevel: permissionLevel ?? null,
      verified,
      lastSyncedAt: new Date().toISOString(),
    });

    const updatedCredential = await supabaseService.getGscCredentialByUserId(userId);
    revalidatePath('/setup');
    revalidatePath('/gsc-setup');
    return { success: true, data: toGscConnectionStatus(updatedCredential) };
  } catch (error) {
    console.error('[GSC Setup] save property failed', error);
    return { success: false, error: 'プロパティの保存に失敗しました' };
  }
}

export async function disconnectGsc() {
  try {
    const { userId, error } = await getAuthUserId();
    if (error || !userId) {
      return { success: false, error: error || 'ユーザー認証に失敗しました' };
    }
    await supabaseService.deleteGscCredential(userId);
    revalidatePath('/setup');
    revalidatePath('/gsc-setup');
    return { success: true };
  } catch (error) {
    console.error('[GSC Setup] disconnect failed', error);
    return { success: false, error: '連携解除に失敗しました' };
  }
}
