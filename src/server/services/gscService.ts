import type { GscPropertyType, GscSiteEntry } from '@/types/gsc';
import { GoogleTokenService, type GoogleOAuthTokens, type GoogleUserInfoResponse } from './googleTokenService';

interface GoogleSitesResponse {
  siteEntry?: Array<{
    siteUrl?: string;
    permissionLevel?: string;
  }>;
}

const SITES_ENDPOINT = 'https://www.googleapis.com/webmasters/v3/sites';

export class GscService {
  private readonly tokenService: GoogleTokenService;

  constructor(tokenService?: GoogleTokenService) {
    this.tokenService = tokenService ?? new GoogleTokenService();
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleOAuthTokens> {
    return this.tokenService.exchangeCodeForTokens(code, redirectUri);
  }

  async refreshAccessToken(refreshToken: string): Promise<GoogleOAuthTokens> {
    return this.tokenService.refreshAccessToken(refreshToken);
  }

  async fetchUserInfo(accessToken: string): Promise<GoogleUserInfoResponse> {
    return this.tokenService.fetchUserInfo(accessToken);
  }

  async listSites(accessToken: string): Promise<GscSiteEntry[]> {
    const response = await fetch(SITES_ENDPOINT, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Search Consoleサイト一覧の取得に失敗しました: ${response.status} ${text}`);
    }

    const body = (await response.json()) as GoogleSitesResponse;
    const entries = Array.isArray(body.siteEntry) ? body.siteEntry : [];

    return entries
      .filter(entry => typeof entry.siteUrl === 'string' && entry.siteUrl.length > 0)
      .map(entry => {
        const siteUrl = entry.siteUrl as string;
        const permissionLevel = entry.permissionLevel ?? 'unknown';
        const propertyType: GscPropertyType = siteUrl.startsWith('sc-domain:')
          ? 'sc-domain'
          : 'url-prefix';
        const displayName = formatGscPropertyDisplayName(siteUrl);
        const verified = permissionLevel !== 'siteUnverifiedUser';
        return {
          siteUrl,
          permissionLevel,
          propertyType,
          displayName,
          verified,
        };
      });
  }
}

export function formatGscPropertyDisplayName(siteUrl: string): string {
  if (siteUrl.startsWith('sc-domain:')) {
    return siteUrl.replace('sc-domain:', '');
  }
  try {
    const url = new URL(siteUrl);
    const normalizedPath = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
    return `${url.protocol}//${url.host}${normalizedPath}`;
  } catch {
    return siteUrl;
  }
}

