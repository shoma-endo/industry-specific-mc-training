import { NextRequest, NextResponse } from 'next/server';
import { resolveWordPressContext } from '@/server/services/wordpressContext';

type WpPostTitle = { rendered?: string } | string | undefined;
type WpPostExcerpt = { rendered?: string } | string | undefined;

interface WpRestTerm {
  id?: number;
  name?: string;
}

interface WpRestPost {
  id?: number;
  ID?: number;
  date?: string;
  modified?: string;
  title?: WpPostTitle;
  link?: string;
  categories?: number[];
  excerpt?: WpPostExcerpt;
  _embedded?: {
    'wp:term'?: Array<Array<WpRestTerm>>;
  };
}

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
        { success: false, error: `WordPress投稿取得エラー: HTTP ${resp.status} ${txt}` },
        { status: 502 }
      );
    }

    const postsJson: unknown = await resp.json();
    const posts: WpRestPost[] = Array.isArray(postsJson) ? (postsJson as WpRestPost[]) : [];
    const total = parseInt(resp.headers.get('X-WP-Total') || '0', 10);

    // 必要フィールドのみ整形
    const normalized = posts.map(
      (
        p
      ): {
        id: number | string | undefined;
        date: string | undefined;
        title: string | undefined;
        link: string | undefined;
        categories: number[] | undefined;
        categoryNames: string[];
        excerpt: string | undefined;
      } => {
        const termsNested = p._embedded?.['wp:term'] ?? [];
        const firstTaxonomy =
          Array.isArray(termsNested) && termsNested.length > 0 ? termsNested[0] : [];
        const categoryNames = (firstTaxonomy || [])
          .filter((t: WpRestTerm) => Boolean(t && t.name))
          .map((t: WpRestTerm) => t.name as string);

        const renderedTitle = typeof p.title === 'string' ? p.title : p.title?.rendered;
        const renderedExcerpt = typeof p.excerpt === 'string' ? p.excerpt : p.excerpt?.rendered;

        return {
          id: p.id ?? p.ID,
          date: p.date ?? p.modified,
          title: renderedTitle,
          link: p.link,
          categories: p.categories,
          categoryNames,
          excerpt: renderedExcerpt,
        };
      }
    );

    return NextResponse.json({ success: true, data: { posts: normalized, total } });
  } catch (error) {
    console.error('WP posts API error:', error);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
