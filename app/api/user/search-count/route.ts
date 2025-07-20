import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Google Search機能は廃止されました
    return NextResponse.json(
      {
        error: 'Google Search feature has been deprecated',
      },
      { status: 410 }
    ); // Gone
  } catch (error) {
    console.error('Error in search-count API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
