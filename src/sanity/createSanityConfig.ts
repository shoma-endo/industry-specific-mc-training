/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { defineConfig } from 'sanity';
import { deskTool } from 'sanity/desk';
import { structureTool } from 'sanity/structure';
import { schema } from './schemaTypes';
import { structure } from './structure';
import { Iframe } from 'sanity-plugin-iframe-pane';

export function createSanityConfig(projectId: string, dataset: string) {
  const previewUrl =
    process.env.SANITY_STUDIO_PREVIEW_URL || process.env.NEXT_PUBLIC_SITE_URL;

  return defineConfig({
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
                    url: (doc: any) => {
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
    ],
  });
}
