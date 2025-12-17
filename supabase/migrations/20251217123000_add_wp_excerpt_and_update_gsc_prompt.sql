-- content_annotations に WordPress 抜粋を保存する列を追加
alter table if exists public.content_annotations
  add column if not exists wp_excerpt text;

-- ロールバック案
-- カラム削除: alter table if exists public.content_annotations drop column if exists wp_excerpt;
