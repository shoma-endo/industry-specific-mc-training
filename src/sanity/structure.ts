import type { StructureResolver } from 'sanity/structure';

export const structure: StructureResolver = S =>
  S.list()
    .title('コンテンツ')
    .items([
      // ランディングページ → 新規作成は禁止、一覧と編集のみ許可
      S.listItem()
        .title('ランディングページ')
        .id('landing-page-list')
        .child(
          S.documentList()
            .title('ランディングページ')
            .filter('_type == "landingPage"')
            .canHandleIntent(S.documentTypeList('landingPage').getCanHandleIntent())
            .initialValueTemplates([])
        ),

      // 他のドキュメントタイプ（例: 設定やその他）は引き続き表示する場合
      ...S.documentTypeListItems().filter(listItem => listItem.getId() !== 'landingPage'),
    ]);
