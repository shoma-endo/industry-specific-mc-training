import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { WordPressService, WordPressComAuth } from '@/server/services/wordpressService';

// WordPressレスポンスからテキストを安全に抽出するヘルパー関数
function extractWordPressText(field: { raw: string; rendered: string } | string | undefined): string {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field.rendered || field.raw || '';
}

// リクエストボディのバリデーションスキーマ
const createLandingPageSchema = z.object({
  liffAccessToken: z.string(),
  headline: z.string().min(1, '見出しは必須です'),
  description: z.string().min(1, '説明文は必須です'),
  keywords: z.string().optional(),
  businessType: z.string().optional(),
  targetArea: z.string().optional(),
  updateExisting: z.boolean().default(false),
});

interface LandingPageData {
  hero: {
    title: string;
    subtitle: string;
    backgroundImageUrl?: string;
  };
  features?: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  samples?: Array<{
    title: string;
    imageUrl?: string;
    url?: string;
  }>;
  ctaForm?: {
    heading: string;
    description: string;
    fields: string[];
    submitLabel: string;
  };
  faq?: Array<{
    question: string;
    answer: string;
  }>;
  footerLinks?: Array<{
    label: string;
    url?: string;
  }>;
  slug: {
    current: string;
  };
}

// AIは使用しないため、プロンプトは不要

async function generateLandingPageContent(
  headline: string,
  description: string,
): Promise<LandingPageData> {
  // AIは使わず、見出しと説明文から直接シンプルなランディングページを生成
  console.log('シンプルなランディングページコンテンツを生成中...');
  
  // スラッグを生成（日本語を英数字に変換）
  const slug = headline
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50) || 'landing-page';
  
  return {
    hero: {
      title: headline,
      subtitle: description,
    },
    features: [], // 空配列
    samples: [], // 空配列
    ctaForm: {
      heading: '',
      description: '',
      fields: [],
      submitLabel: '',
    },
    faq: [], // 空配列
    footerLinks: [], // 空配列
    slug: {
      current: slug,
    },
  };
}

// ランディングページデータを WordPress形式のHTMLに変換
function convertToWordPressHTML(data: LandingPageData): { title: string; content: string; slug: string } {
  const sections: string[] = [];

  // Hero セクション
  sections.push(`
<div class="hero-section" style="text-align: center; padding: 60px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
  <div class="hero-content" style="max-width: 800px; margin: 0 auto;">
    <h1 style="font-size: 2.5rem; font-weight: bold; margin-bottom: 20px;">${data.hero.title}</h1>
    <p style="font-size: 1.2rem; margin-bottom: 30px; opacity: 0.9;">${data.hero.subtitle}</p>
  </div>
</div>`.trim());

  // 空の配列やオブジェクトをスキップ

  return {
    title: data.hero.title,
    content: sections.join('\n\n'),
    slug: data.slug.current,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createLandingPageSchema.parse(body);

    const {
      liffAccessToken,
      headline,
      description,
      updateExisting,
    } = validatedData;

    // LIFF認証チェック
    const authResult = await authMiddleware(liffAccessToken);
    if (authResult.error || authResult.requiresSubscription || !authResult.userId) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error || '認証またはサブスクリプションが必要です',
        },
        { status: 401 }
      );
    }

    // WordPress.com OAuthトークン取得
    const tokenCookieName = process.env.OAUTH_TOKEN_COOKIE_NAME || 'wpcom_oauth_token';
    const accessToken = request.cookies.get(tokenCookieName)?.value;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'WordPress.comのアクセストークンが見つかりません。連携を行ってください。',
          needsWordPressAuth: true,
        },
        { status: 401 }
      );
    }

    const siteId = process.env.WORDPRESS_COM_SITE_ID;
    if (!siteId) {
      console.error('WORDPRESS_COM_SITE_ID is not set in environment variables.');
      return NextResponse.json(
        { success: false, error: 'WordPressサイトIDが設定されていません。' },
        { status: 500 }
      );
    }

    // 1. AIを使ってランディングページコンテンツを生成
    const landingPageData = await generateLandingPageContent(
      headline,
      description,
    );

    // 2. WordPress形式のHTMLに変換
    const wordpressContent = convertToWordPressHTML(landingPageData);

    // 3. WordPressサービスでページを作成/更新
    const wpAuth: WordPressComAuth = { accessToken, siteId };
    const wordpressService = new WordPressService(wpAuth);

    const wpExportPayload = {
      title: wordpressContent.title,
      content: wordpressContent.content,
      slug: wordpressContent.slug,
      status: 'draft' as const,
      updateExisting: updateExisting,
    };

    // WordPressに固定ページとしてエクスポート
    const exportResult = await wordpressService.exportPageToWordPress(wpExportPayload);

    if (!exportResult.success || !exportResult.data) {
      return NextResponse.json(
        {
          success: false,
          error: exportResult.error || 'WordPressへのランディングページ保存に失敗しました。',
        },
        { status: exportResult.error?.toLowerCase().includes('token') ? 401 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: updateExisting && exportResult.data.status === 'publish'
        ? `WordPressの既存ページを更新しました（ID: ${exportResult.data.ID}）`
        : 'WordPressに新しいランディングページを作成しました',
      data: {
        postId: exportResult.data.ID,
        postUrl: exportResult.data.link,
        title: extractWordPressText(exportResult.data.title),
        slug: exportResult.data.slug || wordpressContent.slug,
        status: exportResult.data.status,
        action: updateExisting ? 'updated' : 'created',
        exportType: 'page',
      },
      postUrl: exportResult.postUrl,
    });
  } catch (error) {
    console.error('Landing page creation error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'リクエストデータが無効です', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'ランディングページ作成中に予期せぬエラーが発生しました' },
      { status: 500 }
    );
  }
}