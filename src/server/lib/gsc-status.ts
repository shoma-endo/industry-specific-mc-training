import type { GscConnectionStatus, GscCredential, GscPropertyType } from '@/types/gsc';
import { formatGscPropertyDisplayName } from '@/server/services/gscService';

const ACCESS_TOKEN_SAFETY_MARGIN_MS = 60 * 1000; // 1 minute

export function toGscConnectionStatus(credential: GscCredential | null): GscConnectionStatus {
  if (!credential) {
    return { connected: false };
  }

  // トークンの有効性をチェック
  // accessToken と accessTokenExpiresAt が存在し、かつ有効期限内である場合のみ接続済みとする
  const hasValidToken =
    credential.accessToken &&
    credential.accessTokenExpiresAt &&
    new Date(credential.accessTokenExpiresAt).getTime() - Date.now() > ACCESS_TOKEN_SAFETY_MARGIN_MS;

  if (!hasValidToken) {
    return { connected: false };
  }

  const propertyDisplayName =
    credential.propertyDisplayName ||
    (credential.propertyUri ? formatGscPropertyDisplayName(credential.propertyUri) : null);

  return {
    connected: true,
    googleAccountEmail: credential.googleAccountEmail ?? null,
    propertyUri: credential.propertyUri ?? null,
    propertyDisplayName,
    propertyType: credential.propertyType ?? null,
    permissionLevel: credential.permissionLevel ?? null,
    verified: credential.verified ?? null,
    lastSyncedAt: credential.lastSyncedAt ?? null,
    updatedAt: credential.updatedAt ?? null,
    scope: credential.scope ?? null,
  };
}

export function propertyTypeFromUri(uri: string): GscPropertyType {
  return uri.startsWith('sc-domain:') ? 'sc-domain' : 'url-prefix';
}
