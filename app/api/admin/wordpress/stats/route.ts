import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { getUserRole, isAdmin } from '@/lib/auth-utils';
import { SupabaseService } from '@/server/services/supabaseService';

type WordPressType = 'wordpress_com' | 'self_hosted';

interface WordPressSettingsRow {
  id: string;
  user_id: string;
  wp_type: WordPressType;
  wp_site_id?: string | null;
  wp_site_url?: string | null;
  wp_username?: string | null;
  wp_application_password?: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const liffAccessToken = request.cookies.get('line_access_token')?.value;
    const refreshToken = request.cookies.get('line_refresh_token')?.value;

    if (!liffAccessToken) {
      return NextResponse.json({ success: false, error: 'LINE認証が必要です' }, { status: 401 });
    }

    // 基本認証チェック（期限切れ対応など）
    const authResult = await authMiddleware(liffAccessToken, refreshToken);
    if (authResult.error) {
      return NextResponse.json(
        { success: false, error: 'ユーザー認証に失敗しました' },
        { status: 401 }
      );
    }

    // 管理者権限チェック
    const role = await getUserRole(liffAccessToken);
    if (!isAdmin(role)) {
      return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 });
    }

    const supabaseService = new SupabaseService();
    const client = supabaseService.getClient();

    const { data, error } = await client
      .from('wordpress_settings')
      .select(
        'id, user_id, wp_type, wp_site_id, wp_site_url, wp_username, wp_application_password, created_at, updated_at'
      )
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('WordPress stats fetch error:', error);
      return NextResponse.json(
        { success: false, error: 'データの取得に失敗しました' },
        { status: 500 }
      );
    }

    const rows: WordPressSettingsRow[] = (data as unknown as WordPressSettingsRow[]) || [];

    // is_active を計算（必要フィールドが揃っているかで簡易判定）
    const connections = rows.map(r => {
      const isActive =
        r.wp_type === 'wordpress_com'
          ? Boolean(r.wp_site_id)
          : Boolean(r.wp_site_url && r.wp_username && r.wp_application_password);
      return {
        id: r.id,
        user_id: r.user_id,
        wp_type: r.wp_type,
        is_active: isActive,
        created_at: r.created_at,
        updated_at: r.updated_at,
      };
    });

    const totalConnections = connections.length;
    const activeConnections = connections.filter(s => s.is_active).length;
    const wordpressComConnections = connections.filter(s => s.wp_type === 'wordpress_com').length;
    const selfHostedConnections = connections.filter(s => s.wp_type === 'self_hosted').length;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentUpdates = connections.filter(s => new Date(s.updated_at) > thirtyDaysAgo).length;

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalConnections,
          activeConnections,
          inactiveConnections: totalConnections - activeConnections,
          wordpressComConnections,
          selfHostedConnections,
          recentUpdates,
        },
        connections,
      },
    });
  } catch (error) {
    console.error('WordPress stats API error:', error);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
