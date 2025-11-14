export type GscPropertyType = 'sc-domain' | 'url-prefix';

export interface GscCredential {
  id: string;
  userId: string;
  googleAccountEmail?: string | null;
  refreshToken: string;
  accessToken?: string | null;
  accessTokenExpiresAt?: string | null;
  scope?: string[] | null;
  propertyUri?: string | null;
  propertyType?: GscPropertyType | null;
  propertyDisplayName?: string | null;
  permissionLevel?: string | null;
  verified?: boolean | null;
  lastSyncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GscConnectionStatus {
  connected: boolean;
  googleAccountEmail?: string | null;
  propertyUri?: string | null;
  propertyDisplayName?: string | null;
  propertyType?: GscPropertyType | null;
  permissionLevel?: string | null;
  verified?: boolean | null;
  lastSyncedAt?: string | null;
  updatedAt?: string | null;
  scope?: string[] | null;
}

export interface GscSiteEntry {
  siteUrl: string;
  permissionLevel: string;
  propertyType: GscPropertyType;
  displayName: string;
  verified: boolean;
}
