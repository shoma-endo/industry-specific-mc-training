-- 広告用カラムを削除し、WPスニペット運用に一本化
alter table if exists public.content_annotations
  drop column if exists ads_headline,
  drop column if exists ads_description;

-- ロールバック案
-- alter table if exists public.content_annotations
--   add column if not exists ads_headline text null,
--   add column if not exists ads_description text null;
