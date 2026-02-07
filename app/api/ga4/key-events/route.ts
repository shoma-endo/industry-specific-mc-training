import { NextRequest, NextResponse } from 'next/server';
import { fetchGa4KeyEvents } from '@/server/actions/ga4Setup.actions';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get('propertyId');

  if (!propertyId) {
    return NextResponse.json(
      { success: false, error: 'propertyId is required' },
      { status: 400 }
    );
  }

  try {
    const result = await fetchGa4KeyEvents(propertyId);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error('Failed to fetch GA4 key events:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
