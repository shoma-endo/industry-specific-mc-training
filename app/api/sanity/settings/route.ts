import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';

const supabaseService = new SupabaseService();

export async function POST(request: NextRequest) {
  try {
    const { liffAccessToken, projectId, dataset } = await request.json();
    
    if (!liffAccessToken || !projectId) {
      return NextResponse.json(
        { success: false, error: 'Required fields missing' },
        { status: 400 }
      );
    }

    const liffToken = request.cookies.get('line_access_token')?.value || liffAccessToken;
    const refreshToken = request.cookies.get('line_refresh_token')?.value;
    
    const authResult = await authMiddleware(liffToken, refreshToken);
    
    if (authResult.error || !authResult.userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication failed' },
        { status: 401 }
      );
    }

    // Sanity設定を保存
    await supabaseService.createSanityProject(
      authResult.userId, 
      projectId, 
      dataset || 'production'
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Sanity settings saved successfully' 
    });
  } catch (error) {
    console.error('[Sanity Settings API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}