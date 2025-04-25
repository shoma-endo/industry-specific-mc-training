'use client';

/**
 * This configuration is used to for the Sanity Studio that's mounted on the `/app/studio/[[...tool]]/page.tsx` route
 */

import { defineConfig } from 'sanity';
// import { visionTool } from '@sanity/vision';
import { structureTool } from 'sanity/structure';

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
    // サイドバー構造（Structureを日本語で表示）
    structureTool({ structure, title: 'コンテンツ' }),
    // クエリエディタを日本語で表示。必要であればカスタム Vision Toolを作る
    // visionTool({ defaultApiVersion: apiVersion, title: 'クエリ' }),
  ],
});
