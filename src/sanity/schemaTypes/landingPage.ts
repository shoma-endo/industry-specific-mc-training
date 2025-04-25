// src/sanity/schemaTypes/landingPage.ts
import { defineType, defineField, defineArrayMember } from 'sanity';

// ランディングページ全体を表すLiteWordのドキュメントタイプ
export default defineType({
  name: 'landingPage',
  title: 'ランディングページ',
  type: 'document',
  fields: [
    // Hero セクション
    defineField({
      name: 'hero',
      title: 'ヒーローセクション',
      type: 'object',
      fields: [
        defineField({ name: 'title', title: '見出し', type: 'string' }),
        defineField({ name: 'subtitle', title: 'サブ見出し', type: 'text' }),
        defineField({ name: 'backgroundImage', title: '背景画像', type: 'image' }),
      ],
    }),
    // URL スラッグ
    defineField({
      name: 'slug',
      title: 'URL スラッグ',
      type: 'slug',
      options: { source: 'hero.title', maxLength: 96 },
      validation: Rule => Rule.required().error('URLスラッグは必須です'),
    }),
    // ポイント（Why Choose）セクション
    defineField({
      name: 'features',
      title: '選ばれる理由（Features）',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'featureItem',
          fields: [
            defineField({ name: 'title', title: 'ポイント見出し', type: 'string' }),
            defineField({ name: 'description', title: '説明文', type: 'text' }),
            defineField({ name: 'icon', title: 'アイコン（lucide 名称）', type: 'string' }),
          ],
        }),
      ],
    }),
    // サンプル紹介（PAGE SAMPLE）
    defineField({
      name: 'samples',
      title: 'ページサンプル',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'sampleItem',
          fields: [
            defineField({ name: 'title', title: 'サンプル名', type: 'string' }),
            defineField({ name: 'image', title: 'サムネイル', type: 'image' }),
            defineField({ name: 'url', title: 'リンクURL', type: 'url' }),
          ],
        }),
      ],
    }),
    // CTA フォーム
    defineField({
      name: 'ctaForm',
      title: 'ダウンロードCTA',
      type: 'object',
      fields: [
        defineField({ name: 'heading', title: 'フォーム見出し', type: 'string' }),
        defineField({ name: 'description', title: 'フォーム説明', type: 'text' }),
        defineField({
          name: 'fields',
          title: '入力フィールド',
          type: 'array',
          of: [{ type: 'string' }],
        }),
        defineField({ name: 'submitLabel', title: 'ボタンラベル', type: 'string' }),
      ],
    }),
    // FAQ セクション
    defineField({
      name: 'faq',
      title: 'よくある質問',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'faqItem',
          fields: [
            defineField({ name: 'question', title: '質問', type: 'string' }),
            defineField({ name: 'answer', title: '回答', type: 'text' }),
          ],
        }),
      ],
    }),
    // Footer リンク
    defineField({
      name: 'footerLinks',
      title: 'フッターリンク',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'footerLink',
          fields: [
            defineField({ name: 'label', title: 'ラベル', type: 'string' }),
            defineField({ name: 'url', title: 'URL', type: 'url' }),
          ],
        }),
      ],
    }),
  ],
});
