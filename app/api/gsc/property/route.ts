import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';
import { propertyTypeFromUri, toGscConnectionStatus } from '@/server/lib/googleSearchConsoleStatus';
import { formatGscPropertyDisplayName } from '@/server/services/googleSearchConsoleService';

const supabaseService = new SupabaseService();

export async function POST(request: NextRequest) {
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

  let payload: { propertyUri?: string; permissionLevel?: string | null } = {};
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ success: false, error: 'JSONの解析に失敗しました' }, { status: 400 });
  }

  const propertyUri = typeof payload.propertyUri === 'string' ? payload.propertyUri.trim() : '';
  if (!propertyUri) {
    return NextResponse.json(
      { success: false, error: 'propertyUriは必須です' },
      { status: 400 }
    );
  }

  const credential = await supabaseService.getGscCredentialByUserId(authResult.userId);
  if (!credential) {
    return NextResponse.json(
      { success: false, error: 'Google Search Consoleが未接続です' },
      { status: 404 }
    );
  }

  const propertyType = propertyTypeFromUri(propertyUri);
  const permissionLevel =
    typeof payload.permissionLevel === 'string' ? payload.permissionLevel : credential.permissionLevel;
  const verified = permissionLevel ? permissionLevel !== 'siteUnverifiedUser' : credential.verified ?? null;

  await supabaseService.updateGscCredential(authResult.userId, {
    propertyUri,
    propertyType,
    propertyDisplayName: formatGscPropertyDisplayName(propertyUri),
    permissionLevel: permissionLevel ?? null,
    verified,
    lastSyncedAt: new Date().toISOString(),
  });

  const updatedCredential = await supabaseService.getGscCredentialByUserId(authResult.userId);

  return NextResponse.json({
    success: true,
    data: toGscConnectionStatus(updatedCredential),
  });
}
