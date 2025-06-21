import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/server/middleware/auth.middleware';

export async function GET(request: NextRequest) {
  try {
    const liffAccessToken = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!liffAccessToken) {
      return NextResponse.json({ error: 'Authorization header is required' }, { status: 401 });
    }

    const auth = await authMiddleware(liffAccessToken);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    return NextResponse.json({ 
      googleSearchCount: auth.user?.googleSearchCount || 0
    });
  } catch (error) {
    console.error('Error getting search count:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}