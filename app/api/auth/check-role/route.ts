import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserRole } from '@/lib/auth-utils';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const lineAccessToken = cookieStore.get('line_access_token')?.value;

    if (!lineAccessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const role = await getUserRole(lineAccessToken);
    
    if (!role) {
      return NextResponse.json({ error: 'Unable to get user role' }, { status: 401 });
    }

    return NextResponse.json({ role });
  } catch (error) {
    console.error('Role check API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}