import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';

const supabaseService = new SupabaseService();

export async function GET() {
  try {
    // 管理者のみアクセス可能（開発環境でのデバッグ用）
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { success: false, error: 'Not available in production' },
        { status: 403 }
      );
    }

    const allProjects = await supabaseService.getAllSanityProjects();

    // 'production' データセットを使用しているレコードを特定
    const productionProjects = allProjects.filter(p => p.dataset === 'production');

    return NextResponse.json({
      success: true,
      totalProjects: allProjects.length,
      productionProjects: productionProjects.length,
      projects: allProjects,
      needsUpdate: productionProjects,
    });
  } catch (error) {
    console.error('[Sanity Settings GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PUT() {
  try {
    // 管理者のみアクセス可能（開発環境でのデバッグ用）
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { success: false, error: 'Not available in production' },
        { status: 403 }
      );
    }

    // 'production' データセットを 'development' に一括更新
    const { data, error } = await supabaseService.supabase
      .from('sanity_projects')
      .update({ dataset: 'development' })
      .eq('dataset', 'production')
      .select();

    if (error) {
      console.error('[Sanity Settings PUT] Error updating datasets:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully updated production datasets to development',
      updatedRecords: data?.length || 0,
      updatedData: data,
    });
  } catch (error) {
    console.error('[Sanity Settings PUT] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { liffAccessToken, projectId, dataset } = await request.json();

    if (!liffAccessToken || !projectId || !dataset) {
      return NextResponse.json(
        { success: false, error: 'Required fields missing: liffAccessToken, projectId, dataset' },
        { status: 400 }
      );
    }

    const liffToken = request.cookies.get('line_access_token')?.value || liffAccessToken;
    const refreshToken = request.cookies.get('line_refresh_token')?.value;

    const authResult = await authMiddleware(liffToken, refreshToken);

    if (authResult.error || !authResult.userId) {
      return NextResponse.json({ success: false, error: 'Authentication failed' }, { status: 401 });
    }

    // Sanity設定を保存
    await supabaseService.createSanityProject(authResult.userId, projectId, dataset);

    return NextResponse.json({
      success: true,
      message: 'Sanity settings saved successfully',
    });
  } catch (error) {
    console.error('[Sanity Settings API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
