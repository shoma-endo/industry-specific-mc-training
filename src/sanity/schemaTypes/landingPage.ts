// src/sanity/schemaTypes/landingPage.ts
import { defineType, defineField, defineArrayMember } from 'sanity';
import { slugify as transliterateSlugify } from 'transliteration';

// ランディングページ全体を表すLiteWordのドキュメントタイプ
export default defineType({
  name: 'landingPage',
  title: 'ランディングページ',
  type: 'document',
  preview: {
    select: {
      title: 'hero.title',
      subtitle: 'slug.current',
      media: 'hero.backgroundImage',
    },
  },
  initialValue: async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/user/current`, {
      credentials: 'include',
    });
    const result = await res.json();

    return {
      userId: result.userId ?? '',
    };
  },
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
      options: {
        source: (doc: { hero?: { title?: string | null }; [key: string]: unknown }) => {
          return doc.hero?.title ?? '';
        },
        slugify: (input: string): string => {
          const slugifyOptions = {
            lowercase: true,
            separator: '-',
            replace: { '+': 'plus' },
            allowedChars: 'a-zA-Z0-9-',
          };
          const slug = transliterateSlugify(input, slugifyOptions);
          return slug.slice(0, 96);
        },
        maxLength: 96,
      },
      validation: Rule =>
        Rule.required().custom(async (slug, context) => {
          const userId = context.document?.userId;
          if (!slug || !userId) return true; // slug or userIdが無ければスキップ

          // 編集中のドキュメントIDから 'drafts.' プレフィックスを除去
          const docId = context.document?._id.replace(/^drafts\./, '');
          const params = {
            draft: `drafts.${docId}`,
            published: docId,
            slug: slug.current,
            userId,
          };
          // 自分自身（draft と published の両方）を除外して重複チェックを行うクエリ
          const query = `!defined(*[_type == "landingPage" && !(_id in [$draft, $published]) && slug.current == $slug && userId == $userId][0]._id)`;
          const isUnique = await context
            .getClient({ apiVersion: '2023-01-01' })
            .fetch(query, params);

          return isUnique ? true : 'このスラッグは既に存在します（あなたのLP内で重複しています）';
        }),
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
    // ユーザーID
    defineField({
      name: 'userId',
      title: 'ユーザーID',
      type: 'string',
      readOnly: true,
      hidden: true,
      validation: Rule => Rule.required().error('ユーザーIDは必須です'),
    }),
  ],
});
