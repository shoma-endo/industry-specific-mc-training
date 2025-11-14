import type { GscPropertyType, GscSiteEntry } from '@/types/gsc';

export interface GoogleOAuthTokens {
  accessToken: string;
  refreshToken?: string | undefined;
  expiresIn?: number | undefined;
  scope?: string[] | undefined;
  idToken?: string | undefined;
  tokenType?: string | undefined;
}

interface GoogleSitesResponse {
  siteEntry?: Array<{
    siteUrl?: string;
    permissionLevel?: string;
  }>;
}

interface GoogleUserInfoResponse {
  email?: string;
  email_verified?: boolean;
}

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USER_INFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';
const SITES_ENDPOINT = 'https://www.googleapis.com/webmasters/v3/sites';

export class GoogleSearchConsoleService {
  private readonly clientId: string | undefined;
  private readonly clientSecret: string | undefined;

  constructor() {
    this.clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    this.clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  }

  private ensureCredentials() {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Google OAuthクライアント情報が設定されていません');
    }
  }

  private parseTokenResponse(body: Record<string, unknown>): GoogleOAuthTokens {
    const accessToken = typeof body.access_token === 'string' ? body.access_token : '';
    if (!accessToken) {
      throw new Error('Google OAuthレスポンスにaccess_tokenが含まれていません');
    }
    const refreshToken =
      typeof body.refresh_token === 'string' && body.refresh_token.length > 0
        ? body.refresh_token
        : undefined;
    const expiresIn =
      typeof body.expires_in === 'number'
        ? body.expires_in
        : typeof body.expires_in === 'string'
          ? Number(body.expires_in)
          : undefined;
    const scope =
      typeof body.scope === 'string'
        ? body.scope
            .split(' ')
            .map(s => s.trim())
            .filter(Boolean)
        : undefined;
    const idToken = typeof body.id_token === 'string' ? body.id_token : undefined;
    const tokenType = typeof body.token_type === 'string' ? body.token_type : undefined;

    return {
      accessToken,
      refreshToken,
      expiresIn,
      scope,
      idToken,
      tokenType,
    };
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleOAuthTokens> {
    this.ensureCredentials();
    const params = new URLSearchParams({
      client_id: this.clientId as string,
      client_secret: this.clientSecret as string,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google OAuthトークン交換に失敗しました: ${response.status} ${text}`);
    }

    const body = (await response.json()) as Record<string, unknown>;
    return this.parseTokenResponse(body);
  }

  async refreshAccessToken(refreshToken: string): Promise<GoogleOAuthTokens> {
    this.ensureCredentials();
    const params = new URLSearchParams({
      client_id: this.clientId as string,
      client_secret: this.clientSecret as string,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google OAuthトークンリフレッシュに失敗しました: ${response.status} ${text}`);
    }

    const body = (await response.json()) as Record<string, unknown>;
    return this.parseTokenResponse(body);
  }

  async fetchUserInfo(accessToken: string): Promise<GoogleUserInfoResponse> {
    const response = await fetch(USER_INFO_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Googleユーザー情報の取得に失敗しました: ${response.status} ${text}`);
    }

    return (await response.json()) as GoogleUserInfoResponse;
  }

  async listSites(accessToken: string): Promise<GscSiteEntry[]> {
    const response = await fetch(`${SITES_ENDPOINT}/list`, {
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
