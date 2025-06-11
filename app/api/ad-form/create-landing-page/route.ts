import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { WordPressService, WordPressComAuth } from '@/server/services/wordpressService';
import { openAiService } from '@/server/services/openAiService';

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

// AIプロンプトを使ってランディングページ構造を生成
const LP_GENERATION_PROMPT = `
あなたはマーケティングとWebサイト制作のプロフェッショナルです。
提供された広告文情報から効果的なランディングページのコンテンツを生成してください。

## 出力形式
以下のJSON形式で出力してください：

{
  "hero": {
    "title": "魅力的なメインタイトル（30文字以内）",
    "subtitle": "サブタイトル・説明文（80文字以内）"
  },
  "features": [
    {
      "icon": "🔧",
      "title": "特徴のタイトル",
      "description": "特徴の詳細説明"
    }
  ],
  "samples": [
    {
      "title": "サンプル・事例のタイトル",
      "url": "#"
    }
  ],
  "ctaForm": {
    "heading": "お問い合わせフォームのタイトル",
    "description": "フォームの説明文",
    "fields": ["お名前", "電話番号", "メールアドレス", "お問い合わせ内容"],
    "submitLabel": "送信ボタンのテキスト"
  },
  "faq": [
    {
      "question": "よくある質問",
      "answer": "回答"
    }
  ],
  "footerLinks": [
    {
      "label": "プライバシーポリシー",
      "url": "#"
    }
  ],
  "slug": {
    "current": "適切なURLスラッグ（英数字とハイフンのみ）"
  }
}

## 生成ルール
1. heroセクション：見出しと説明文から魅力的なタイトルとサブタイトルを作成
2. featuresセクション：サービスの特徴を3-4個生成（アイコンは絵文字を使用）
3. samplesセクション：事例やサンプルを2-3個生成
4. ctaFormセクション：お問い合わせフォームの構成を生成
5. faqセクション：想定される質問と回答を3-5個生成
6. footerLinksセクション：フッターリンクを生成
7. slug：タイトルから適切なURLスラッグを生成（日本語は英訳、小文字、ハイフン区切り）

## 制約事項
- 出力はJSONのみ
- 説明や前置きは不要
- 各項目は具体的で魅力的な内容にする
- ターゲット地域やキーワードが提供されている場合は活用する
`;

async function generateLandingPageContent(
  headline: string,
  description: string,
  keywords?: string,
  businessType?: string,
  targetArea?: string
): Promise<LandingPageData> {
  const userInput = `
見出し: ${headline}
説明文: ${description}
${keywords ? `キーワード: ${keywords}` : ''}
${businessType ? `事業タイプ: ${businessType}` : ''}
${targetArea ? `対象地域: ${targetArea}` : ''}
`;

  try {
    const response = await openAiService.sendMessage(
      [
        { role: 'system', content: LP_GENERATION_PROMPT },
        { role: 'user', content: userInput }
      ],
      'gpt-4.1-nano-2025-04-14',
      0.7,
      1
    );

    // JSONレスポンスをパース
    const cleanedResponse = response.message.replace(/```json\n?|\n?```/g, '').trim();
    const landingPageData = JSON.parse(cleanedResponse) as LandingPageData;
    
    return landingPageData;
  } catch (error) {
    console.error('ランディングページ生成エラー:', error);
    
    // フォールバック: 基本的なランディングページ構造を返す
    const fallbackSlug = headline
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    
    return {
      hero: {
        title: headline,
        subtitle: description,
      },
      features: [
        {
          icon: '⭐',
          title: '高品質なサービス',
          description: 'お客様に満足いただける高品質なサービスを提供します',
        },
        {
          icon: '🚀',
          title: '迅速対応',
          description: 'お問い合わせから対応まで迅速に行います',
        },
        {
          icon: '💯',
          title: '安心保証',
          description: '安心してご利用いただける保証制度をご用意しています',
        },
      ],
      ctaForm: {
        heading: 'お気軽にお問い合わせください',
        description: 'ご質問やご相談がございましたら、お気軽にお問い合わせフォームからご連絡ください。',
        fields: ['お名前', '電話番号', 'メールアドレス', 'お問い合わせ内容'],
        submitLabel: 'お問い合わせを送信',
      },
      faq: [
        {
          question: 'サービスの料金はいくらですか？',
          answer: 'お客様のご要望に応じてお見積りを作成いたします。まずはお気軽にお問い合わせください。',
        },
      ],
      footerLinks: [
        {
          label: 'プライバシーポリシー',
          url: '#',
        },
      ],
      slug: {
        current: fallbackSlug || 'landing-page',
      },
    };
  }
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

  // Features セクション
  if (data.features && data.features.length > 0) {
    const featuresHTML = data.features
      .map(
        feature => `
    <div class="feature-item" style="text-align: center; padding: 30px 20px;">
      <div class="feature-icon" style="font-size: 3rem; margin-bottom: 15px;">${feature.icon}</div>
      <h3 style="font-size: 1.3rem; font-weight: 600; margin-bottom: 15px; color: #333;">${feature.title}</h3>
      <p style="color: #666; line-height: 1.6;">${feature.description}</p>
    </div>
  `
      )
      .join('');

    sections.push(`
<div class="features-section" style="padding: 80px 20px; background-color: #f8f9fa;">
  <div style="max-width: 1200px; margin: 0 auto;">
    <h2 style="text-align: center; font-size: 2.5rem; font-weight: bold; margin-bottom: 60px; color: #333;">サービスの特徴</h2>
    <div class="features-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 40px;">
      ${featuresHTML}
    </div>
  </div>
</div>`.trim());
  }

  // Samples セクション
  if (data.samples && data.samples.length > 0) {
    const samplesHTML = data.samples
      .map(
        sample => `
    <div class="sample-item" style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h3 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 15px; color: #333;">${sample.title}</h3>
      ${sample.url ? `<a href="${sample.url}" style="color: #667eea; text-decoration: none; font-weight: 500;">詳細を見る →</a>` : ''}
    </div>
  `
      )
      .join('');

    sections.push(`
<div class="samples-section" style="padding: 80px 20px; background-color: #ffffff;">
  <div style="max-width: 1200px; margin: 0 auto;">
    <h2 style="text-align: center; font-size: 2.5rem; font-weight: bold; margin-bottom: 60px; color: #333;">事例・サンプル</h2>
    <div class="samples-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px;">
      ${samplesHTML}
    </div>
  </div>
</div>`.trim());
  }

  // CTA Form セクション
  if (data.ctaForm) {
    const fieldsHTML = data.ctaForm.fields
      .map(
        field => `
      <input type="text" placeholder="${field}" style="width: 100%; padding: 15px; margin-bottom: 20px; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem;">
    `
      )
      .join('');

    sections.push(`
<div class="cta-form-section" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 80px 20px; text-align: center; color: white;">
  <div style="max-width: 600px; margin: 0 auto;">
    <h2 style="font-size: 2.5rem; font-weight: bold; margin-bottom: 20px;">${data.ctaForm.heading}</h2>
    <p style="font-size: 1.1rem; margin-bottom: 40px; opacity: 0.9;">${data.ctaForm.description}</p>
    <form style="background: white; padding: 40px; border-radius: 8px; color: #333;">
      ${fieldsHTML}
      <button type="submit" style="background: #667eea; color: white; padding: 15px 40px; border: none; border-radius: 4px; font-size: 1.1rem; font-weight: 600; cursor: pointer;">${data.ctaForm.submitLabel}</button>
    </form>
  </div>
</div>`.trim());
  }

  // FAQ セクション
  if (data.faq && data.faq.length > 0) {
    const faqHTML = data.faq
      .map(
        item => `
    <div class="faq-item" style="border-bottom: 1px solid #eee; padding: 30px 0;">
      <h3 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 15px; color: #333;">${item.question}</h3>
      <p style="color: #666; line-height: 1.7;">${item.answer}</p>
    </div>
  `
      )
      .join('');

    sections.push(`
<div class="faq-section" style="padding: 80px 20px; background-color: #f8f9fa;">
  <div style="max-width: 800px; margin: 0 auto;">
    <h2 style="text-align: center; font-size: 2.5rem; font-weight: bold; margin-bottom: 60px; color: #333;">よくある質問</h2>
    <div class="faq-list" style="border-bottom: 1px solid #eee;">
      ${faqHTML}
    </div>
  </div>
</div>`.trim());
  }

  // Footer セクション
  if (data.footerLinks && data.footerLinks.length > 0) {
    const linksHTML = data.footerLinks
      .map(link =>
        link.url
          ? `<a href="${link.url}" style="color: #ccc; text-decoration: none; margin: 0 15px;">${link.label}</a>`
          : `<span style="color: #999; margin: 0 15px;">${link.label}</span>`
      )
      .join('');

    sections.push(`
<div class="footer-section" style="padding: 40px 20px; background: #333; text-align: center;">
  <div style="max-width: 800px; margin: 0 auto;">
    ${linksHTML}
    <p style="color: #999; margin-top: 20px; font-size: 0.9rem;">&copy; ${new Date().getFullYear()} All Rights Reserved.</p>
  </div>
</div>`.trim());
  }

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
      keywords,
      businessType,
      targetArea,
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
      keywords,
      businessType,
      targetArea
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