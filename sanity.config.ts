/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */
// @ts-nocheck
'use client';

/**
 * This configuration is used to for the Sanity Studio that's mounted on the `/app/studio/[[...tool]]/page.tsx` route
 */

import 'dotenv/config';

// プレビュー用のベースURLを環境変数から取得、なければローカルにフォールバック
const previewUrl =
  process.env.SANITY_STUDIO_PREVIEW_URL ||
  process.env.NEXT_PUBLIC_SITE_URL

import { defineConfig } from 'sanity';
// import { visionTool } from '@sanity/vision';
import { structureTool } from 'sanity/structure';
import { deskTool } from 'sanity/desk';
// @ts-ignore: missing type definitions
import { Iframe } from 'sanity-plugin-iframe-pane';

// Go to https://www.sanity.io/docs/api-versioning to learn how API versioning works
import { dataset, projectId } from './src/sanity/env';
import { schema } from './src/sanity/schemaTypes';
import { structure } from './src/sanity/structure';

export default defineConfig({
  basePath: '/studio',
  projectId,
  dataset,
  title: 'LP 管理画面',
  schema,
  plugins: [
    deskTool({
      defaultDocumentNode: (S: any, { schemaType }: { schemaType: string }) =>
        schemaType === 'landingPage'
          ? S.document().views([
              S.view.form(),
              S.view
                .component(Iframe)
                .options({
                  url: (doc: object) => {
                    const slug = doc.slug?.current;
                    return slug ? `${previewUrl}/landingPage/${slug}` : previewUrl;
                  },
                  reload: { button: true },
                })
                .id('preview')
                .title('プレビュー'),
            ])
          : S.document().views([S.view.form()]),
    }),
    structureTool({ structure, title: 'コンテンツ' }),
    // クエリエディタを日本語で表示。必要であればカスタム Vision Toolを作る
    // visionTool({ defaultApiVersion: apiVersion, title: 'クエリ' }),
  ],
});
