-- WordPress記事本文のプレーンテキストを恒久保存

alter table content_annotations
  add column if not exists wp_content_text text null,
  add column if not exists wp_content_fetched_at timestamptz null;

comment on column content_annotations.wp_content_text is 'WordPress記事本文（HTML除去後テキスト）';
comment on column content_annotations.wp_content_fetched_at is 'WordPress記事本文を最終取得した日時';

-- ロールバック案
-- alter table content_annotations
--   drop column if exists wp_content_text,
--   drop column if exists wp_content_fetched_at;
