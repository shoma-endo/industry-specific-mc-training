import { NextResponse } from 'next/server';

// シンプルなキャッシュクリア通知のためのAPI
export async function POST() {
  try {
    // この呼び出しによってクライアントサイドでのリロードやキャッシュクリアを促す
    return NextResponse.json({ success: true, message: 'Cache clear signal sent' });
  } catch (error) {
    console.error('Cache clear API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}