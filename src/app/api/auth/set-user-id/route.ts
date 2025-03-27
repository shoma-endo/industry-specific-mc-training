import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const USER_ID_COOKIE = 'line_user_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30日間

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    (await cookies()).set({
      name: USER_ID_COOKIE,
      value: userId,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting user ID cookie:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
