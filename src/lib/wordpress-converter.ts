import { LandingPageData } from '@/types/sanity';
import { WordPressExportData } from '@/types/wordpress';

/**
 * SanityのランディングページデータをWordPress投稿用のHTMLに変換
 */
export function convertSanityToWordPress(data: LandingPageData): WordPressExportData {
  const htmlContent = generateHTMLContent(data);

  return {
    title: data.hero.title,
    content: htmlContent,
    excerpt: data.hero.subtitle || '',
    slug: data.slug.current,
    status: 'draft', // デフォルトは下書き
    featuredImageUrl: data.hero.backgroundImageUrl,
  };
}

/**
 * ランディングページの各セクションをHTMLに変換
 */
function generateHTMLContent(data: LandingPageData): string {
  const sections: string[] = [];

  // Hero セクション
  sections.push(generateHeroSection(data.hero));

  // Features セクション
  if (data.features && data.features.length > 0) {
    sections.push(generateFeaturesSection(data.features));
  }

  // Samples セクション
  if (data.samples && data.samples.length > 0) {
    sections.push(generateSamplesSection(data.samples));
  }

  // CTA フォーム セクション
  if (data.ctaForm) {
    sections.push(generateCTASection(data.ctaForm));
  }

  // FAQ セクション
  if (data.faq && data.faq.length > 0) {
    sections.push(generateFAQSection(data.faq));
  }

  // Footer リンク
  if (data.footerLinks && data.footerLinks.length > 0) {
    sections.push(generateFooterSection(data.footerLinks));
  }

  return sections.join('\n\n');
}

/**
 * Hero セクションのHTML生成
 */
function generateHeroSection(hero: LandingPageData['hero']): string {
  return `
<!-- Hero Section -->
<div class="hero-section" style="text-align: center; padding: 60px 20px; background-image: url('${hero.backgroundImageUrl}'); background-size: cover; background-position: center;">
  <div class="hero-content" style="background: rgba(255,255,255,0.9); padding: 40px; border-radius: 10px; display: inline-block;">
    <h1 style="font-size: 2.5rem; font-weight: bold; margin-bottom: 20px; color: #333;">${hero.title}</h1>
    <p style="font-size: 1.2rem; color: #666; margin-bottom: 30px;">${hero.subtitle}</p>
  </div>
</div>`.trim();
}

/**
 * Features セクションのHTML生成
 */
function generateFeaturesSection(features: NonNullable<LandingPageData['features']>): string {
  const featuresHTML = features
    .map(
      feature => `
    <div class="feature-item" style="border: 1px solid #ddd; padding: 30px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <div class="feature-icon" style="font-size: 2rem; margin-bottom: 15px;">${feature.icon}</div>
      <h3 style="font-size: 1.3rem; font-weight: 600; margin-bottom: 15px; color: #333;">${feature.title}</h3>
      <p style="color: #666; line-height: 1.6;">${feature.description}</p>
    </div>
  `
    )
    .join('');

  return `
<!-- Features Section -->
<div class="features-section" style="padding: 60px 20px;">
  <h2 style="text-align: center; font-size: 2rem; font-weight: bold; margin-bottom: 40px; color: #333;">選ばれる理由</h2>
  <div class="features-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; max-width: 1200px; margin: 0 auto;">
    ${featuresHTML}
  </div>
</div>`.trim();
}

/**
 * Samples セクションのHTML生成
 */
function generateSamplesSection(samples: NonNullable<LandingPageData['samples']>): string {
  const samplesHTML = samples
    .map(
      sample => `
    <div class="sample-item" style="border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: box-shadow 0.3s;">
      ${sample.imageUrl ? `<img src="${sample.imageUrl}" alt="${sample.title}" style="width: 100%; height: 200px; object-fit: cover;">` : ''}
      <div style="padding: 20px;">
        <h3 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 10px; color: #333;">${sample.title}</h3>
        <a href="${sample.url}" target="_blank" style="color: #0066cc; text-decoration: none; font-weight: 500;">詳細を見る →</a>
      </div>
    </div>
  `
    )
    .join('');

  return `
<!-- Samples Section -->
<div class="samples-section" style="padding: 60px 20px; background-color: #f8f9fa;">
  <h2 style="text-align: center; font-size: 2rem; font-weight: bold; margin-bottom: 40px; color: #333;">ページサンプル</h2>
  <div class="samples-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; max-width: 1200px; margin: 0 auto;">
    ${samplesHTML}
  </div>
</div>`.trim();
}

/**
 * CTA セクションのHTML生成
 */
function generateCTASection(ctaForm: NonNullable<LandingPageData['ctaForm']>): string {
  let fieldsHTML = '';

  if (ctaForm.fields && Array.isArray(ctaForm.fields) && ctaForm.fields.length > 0) {
    fieldsHTML = ctaForm.fields
      .map(
        field => `
      <input type="text" placeholder="${field}" style="width: 100%; padding: 12px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem;">
    `
      )
      .join('');
  }

  const headingHTML = ctaForm.heading
    ? `<h2 style="font-size: 2em; margin-bottom: 10px; color: #333;">${ctaForm.heading}</h2>`
    : '';
  const descriptionHTML = ctaForm.description
    ? `<p style="font-size: 1.1em; margin-bottom: 30px; color: #555;">${ctaForm.description}</p>`
    : '';
  const submitButtonHTML = ctaForm.submitLabel
    ? `<button type="submit" style="background-color: #0073aa; color: white; padding: 15px 30px; border: none; border-radius: 4px; font-size: 1.1em; cursor: pointer;">${ctaForm.submitLabel}</button>`
    : '';

  if (headingHTML || descriptionHTML || fieldsHTML || submitButtonHTML) {
    return `
      <section class="cta-form-section" style="background-color: #f7f7f7; padding: 40px 20px; text-align: center;">
        ${headingHTML}
        ${descriptionHTML}
        <form style="max-width: 500px; margin: 0 auto;">
          ${fieldsHTML}
          ${submitButtonHTML}
        </form>
      </section>
    `;
  }

  return '';
}

/**
 * FAQ セクションのHTML生成
 */
function generateFAQSection(faq: NonNullable<LandingPageData['faq']>): string {
  const faqHTML = faq
    .map(
      item => `
    <div class="faq-item" style="border-bottom: 1px solid #eee; padding: 25px 0;">
      <h3 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 15px; color: #333;">${item.question}</h3>
      <p style="color: #666; line-height: 1.6;">${item.answer}</p>
    </div>
  `
    )
    .join('');

  return `
<!-- FAQ Section -->
<div class="faq-section" style="padding: 60px 20px;">
  <h2 style="text-align: center; font-size: 2rem; font-weight: bold; margin-bottom: 40px; color: #333;">よくある質問</h2>
  <div style="max-width: 800px; margin: 0 auto;">
    ${faqHTML}
  </div>
</div>`.trim();
}

/**
 * Footer セクションのHTML生成
 */
function generateFooterSection(footerLinks: NonNullable<LandingPageData['footerLinks']>): string {
  const linksHTML = footerLinks
    .map(link =>
      link.url
        ? `<a href="${link.url}" style="color: #666; text-decoration: none; margin: 0 15px; font-size: 0.9rem;">${link.label}</a>`
        : `<span style="color: #ccc; margin: 0 15px; font-size: 0.9rem;">${link.label}</span>`
    )
    .join('');

  return `
<!-- Footer Section -->
<div class="footer-section" style="padding: 40px 20px; border-top: 1px solid #eee; text-align: center; background-color: #f8f9fa;">
  <div style="max-width: 800px; margin: 0 auto;">
    ${linksHTML}
  </div>
</div>`.trim();
}

/**
 * HTMLをプレビュー用にクリーンアップ
 */
export function generatePreviewHTML(data: LandingPageData): string {
  const content = generateHTMLContent(data);

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.hero.title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    @media (max-width: 768px) {
      .features-grid, .samples-grid {
        grid-template-columns: 1fr !important;
      }
      .hero-section h1 {
        font-size: 2rem !important;
      }
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>`.trim();
}
