import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { getLiffTokensFromRequest } from '@/server/lib/auth-helpers';
import { ga4ImportService } from '@/server/services/ga4ImportService';
import { ERROR_MESSAGES } from '@/domain/errors/error-messages';

export async function POST(request: NextRequest) {
  const { accessToken, refreshToken } = getLiffTokensFromRequest(request);
  const authResult = await authMiddleware(accessToken, refreshToken);

  if (authResult.error || !authResult.userId) {
    return NextResponse.json(
      { success: false, error: authResult.error || ERROR_MESSAGES.AUTH.USER_AUTH_FAILED },
      { status: 401 }
    );
  }

  if (authResult.viewMode || authResult.ownerUserId) {
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.AUTH.OWNER_ACCOUNT_REQUIRED },
      { status: 403 }
    );
  }

  try {
    const summary = await ga4ImportService.syncUser(authResult.userId);
    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    console.error('[ga4/sync] manual sync failed', error);
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.GA4.SYNC_FAILED },
      { status: 500 }
    );
  }
}
