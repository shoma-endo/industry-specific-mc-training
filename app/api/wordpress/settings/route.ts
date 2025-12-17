import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';
import { normalizeContentTypes } from '@/server/services/wordpressContentTypes';

const supabaseService = new SupabaseService();

export async function POST(request: NextRequest) {
  try {
    const {
      wpType,
      wpSiteId,
      wpSiteUrl,
      wpUsername,
      wpApplicationPassword,
      wpContentTypes,
    } = await request.json();

    const parsedContentTypes = Array.isArray(wpContentTypes)
      ? wpContentTypes
      : typeof wpContentTypes === 'string'
        ? wpContentTypes.split(',').map((value: string) => value.trim())
        : undefined;
    const contentTypes = normalizeContentTypes(parsedContentTypes);

    // 認証情報はCookieから取得（セキュリティベストプラクティス）
    const liffToken = request.cookies.get('line_access_token')?.value;
    const refreshToken = request.cookies.get('line_refresh_token')?.value;

    if (!liffToken || !wpType) {
      return NextResponse.json(
        { success: false, error: 'Authentication required or required fields missing' },
        { status: 401 }
      );
    }

    const authResult = await authMiddleware(liffToken, refreshToken);
    
    if (authResult.error || !authResult.userId || !authResult.userDetails?.role) {
      return NextResponse.json(
        { success: false, error: 'Authentication failed' },
        { status: 401 }
      );
    }

    const isAdmin = authResult.userDetails.role === 'admin';

    // 管理者以外はWordPress.comを禁止
    if (!isAdmin && wpType !== 'self_hosted') {
      return NextResponse.json(
        { success: false, error: 'WordPress.com 連携は管理者のみ利用できます。セルフホスト版で設定してください。' },
        { status: 403 }
      );
    }

    // WordPress設定を保存（セルフホスト対応）
    if (wpType === 'self_hosted') {
      if (!wpSiteUrl || !wpUsername || !wpApplicationPassword) {
        return NextResponse.json(
          { success: false, error: 'Self-hosted WordPress requires site URL, username, and application password' },
          { status: 400 }
        );
      }
      
      await supabaseService.createOrUpdateSelfHostedWordPressSettings(
        authResult.userId,
        wpSiteUrl,
        wpUsername,
        wpApplicationPassword,
        { wpContentTypes: contentTypes }
      );
    } else if (wpType === 'wordpress_com') {
      if (!wpSiteId) {
        return NextResponse.json(
          { success: false, error: 'WordPress.com requires site ID' },
          { status: 400 }
        );
      }
      
      // WordPress.com設定を保存（OAuth認証は別途必要）
      await supabaseService.createOrUpdateWordPressSettings(
        authResult.userId,
        '', // clientId - OAuth後に設定
        '', // clientSecret - OAuth後に設定
        wpSiteId,
        { wpContentTypes: contentTypes }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'WordPress settings saved successfully' 
    });
  } catch (error) {
    console.error('[WordPress Settings API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
