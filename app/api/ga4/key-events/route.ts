import { NextRequest, NextResponse } from 'next/server';
import { fetchGa4KeyEvents } from '@/server/actions/ga4Setup.actions';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get('propertyId') ?? '';
  const result = await fetchGa4KeyEvents(propertyId);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
