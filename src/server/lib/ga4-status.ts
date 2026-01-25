import type { Ga4ConnectionStatus } from '@/types/ga4';
import type { GscCredential } from '@/types/gsc';

const ACCESS_TOKEN_SAFETY_MARGIN_MS = 60 * 1000; // 1 minute
const GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

export function toGa4ConnectionStatus(credential: GscCredential | null): Ga4ConnectionStatus {
  if (!credential) {
    return { connected: false };
  }

  const hasValidToken =
    credential.accessToken &&
    credential.accessTokenExpiresAt &&
    new Date(credential.accessTokenExpiresAt).getTime() - Date.now() > ACCESS_TOKEN_SAFETY_MARGIN_MS;

  const scope = credential.scope ?? [];
  const scopeMissing = !scope.includes(GA4_SCOPE);

  return {
    connected: Boolean(credential.ga4PropertyId),
    needsReauth: !hasValidToken || scopeMissing,
    scopeMissing,
    googleAccountEmail: credential.googleAccountEmail ?? null,
    propertyId: credential.ga4PropertyId ?? null,
    propertyName: credential.ga4PropertyName ?? null,
    conversionEvents: credential.ga4ConversionEvents ?? null,
    thresholdEngagementSec: credential.ga4ThresholdEngagementSec ?? null,
    thresholdReadRate: credential.ga4ThresholdReadRate ?? null,
    lastSyncedAt: credential.ga4LastSyncedAt ?? null,
    updatedAt: credential.updatedAt ?? null,
  };
}
