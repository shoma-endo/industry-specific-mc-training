-- Add wp_categories to store WordPress category IDs per annotation
alter table if exists public.content_annotations
  add column if not exists wp_categories bigint[];

-- Rollback
-- alter table if exists public.content_annotations drop column if exists wp_categories;
