-- Google広告クリエイティブの代表値を content_annotations に保持するためのカラム追加
-- 既存のWordPressタイトルと衝突しないよう ads_* で命名

alter table content_annotations
  add column if not exists ads_headline text null,
  add column if not exists ads_description text null,
  add column if not exists ads_synced_at timestamptz null;

comment on column content_annotations.ads_headline is 'Google広告の代表タイトル（Headline）';
comment on column content_annotations.ads_description is 'Google広告の代表説明文（Description）';
comment on column content_annotations.ads_synced_at is 'Google Adsから同期した日時';

-- ロールバック案
-- alter table content_annotations
--   drop column if exists ads_headline,
--   drop column if exists ads_description,
--   drop column if exists ads_synced_at;
