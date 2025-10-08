import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';

const supabaseService = new SupabaseService();

export async function POST(request: NextRequest) {
  try {
    const {
      wpType,
      wpSiteId,
      wpSiteUrl,
      wpUsername,
      wpApplicationPassword
    } = await request.json();

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
    
    if (authResult.error || !authResult.userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication failed' },
        { status: 401 }
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
        wpApplicationPassword
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
        wpSiteId
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