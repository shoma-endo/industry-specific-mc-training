import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { userService } from '@/server/services/userService';

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('line_access_token')?.value;

  if (!accessToken) {
    return NextResponse.json({ userId: null });
  }

  try {
    const user = await userService.getUserFromLiffToken(accessToken);
    return NextResponse.json({ userId: user?.id || null });
  } catch {
    return NextResponse.json({ userId: null });
  }
}
