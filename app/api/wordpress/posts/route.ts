import { NextRequest, NextResponse } from 'next/server';
import { resolveWordPressContext } from '@/server/services/wordpressContext';
import { normalizeWordPressRestPosts } from '@/server/services/wordpressService';
import type { WordPressRestPost, WordPressNormalizedPost } from '@/types/wordpress';

type ApiWordPressPost = Omit<WordPressNormalizedPost, 'canonical_url'>;

export async function GET(request: NextRequest) {
  try {
    const context = await resolveWordPressContext(name => request.cookies.get(name)?.value);

    if (!context.success) {
      if (context.reason === 'settings_missing') {
        return NextResponse.json({ success: true, data: { posts: [], total: 0 } });
      }

      return NextResponse.json(
        { success: false, error: context.message },
        { status: context.status }
      );
    }

    // ページネーション
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = Math.min(parseInt(searchParams.get('per_page') || '20', 10), 100);

    const baseUrl = context.service.getRestBaseUrl();
    const headers = context.service.getRestHeaders();
    const postsUrl = `${baseUrl}/posts?_embed=true&per_page=${perPage}&page=${page}`;
    const resp = await fetch(postsUrl, { headers });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => resp.statusText);
      return NextResponse.json(
        { success: false, error: 'WordPress投稿の取得に失敗しました。設定ダッシュボードで接続設定を確認してください。' },
        { status: 502 }
      );
    }

    const postsJson: unknown = await resp.json();
    const posts: WordPressRestPost[] = Array.isArray(postsJson)
      ? (postsJson as WordPressRestPost[])
      : [];
    const total = parseInt(resp.headers.get('X-WP-Total') || '0', 10);

    const normalizedRaw = normalizeWordPressRestPosts(posts);
    const normalized: ApiWordPressPost[] = normalizedRaw.map(post => {
      const { canonical_url, ...rest } = post;
      void canonical_url;
      return rest;
    });

    return NextResponse.json({ success: true, data: { posts: normalized, total } });
  } catch (error) {
    console.error('WP posts API error:', error);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
