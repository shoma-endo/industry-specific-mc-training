import type { GscConnectionStatus, GscCredential, GscPropertyType } from '@/types/gsc';
import { formatGscPropertyDisplayName } from '@/server/services/googleSearchConsoleService';

export function toGscConnectionStatus(credential: GscCredential | null): GscConnectionStatus {
  if (!credential) {
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
