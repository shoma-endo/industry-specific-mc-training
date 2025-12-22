-- Add wp_category_names to store WordPress category names per annotation
alter table if exists public.content_annotations
  add column if not exists wp_category_names text[];

comment on column content_annotations.wp_category_names is 'WordPressカテゴリー名の配列（wp_categoriesと対応）';

-- Rollback
-- alter table if exists public.content_annotations drop column if exists wp_category_names;

