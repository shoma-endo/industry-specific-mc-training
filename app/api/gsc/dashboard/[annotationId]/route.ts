import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';

const supabaseService = new SupabaseService();

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ annotationId: string }> }
) {
  try {
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

    const userId = authResult.userId;
    const { annotationId } = await context.params;

    // 確認: 注釈がユーザーに属するか
    const { data: annotation, error: annotationError } = await supabaseService
      .getClient()
      .from('content_annotations')
      .select('id, wp_post_title, canonical_url')
      .eq('user_id', userId)
      .eq('id', annotationId)
      .maybeSingle();

    if (annotationError) {
      throw new Error(annotationError.message);
    }
    if (!annotation) {
      return NextResponse.json({ success: false, error: '対象が見つかりません' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const days = Math.min(180, Math.max(7, parseInt(searchParams.get('days') ?? '90', 10)));

    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - days);
    const startIso = startDate.toISOString().slice(0, 10);

    const { data: metrics, error: metricError } = await supabaseService
      .getClient()
      .from('gsc_page_metrics')
      .select('date, position, ctr, clicks, impressions')
      .eq('user_id', userId)
      .eq('content_annotation_id', annotationId)
      .gte('date', startIso)
      .order('date', { ascending: true });

    if (metricError) {
      throw new Error(metricError.message);
    }

    const { data: history, error: historyError } = await supabaseService
      .getClient()
      .from('gsc_article_evaluation_history')
      .select('*')
      .eq('user_id', userId)
      .eq('content_annotation_id', annotationId)
      .order('evaluation_date', { ascending: false })
      .limit(100);

    if (historyError) {
      throw new Error(historyError.message);
    }

    return NextResponse.json({
      success: true,
      data: {
        annotation,
        metrics: metrics ?? [],
        history: history ?? [],
      },
    });
  } catch (error) {
    console.error('[gsc/dashboard/:annotationId] error', error);
    const message = error instanceof Error ? error.message : '詳細データの取得に失敗しました';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
