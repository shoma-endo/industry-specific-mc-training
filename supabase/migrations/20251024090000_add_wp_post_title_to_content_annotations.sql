-- Add wp_post_title column to content_annotations for storing WordPress titles
alter table if exists public.content_annotations
  add column if not exists wp_post_title text;

-- Rollback plan:
-- alter table if exists public.content_annotations drop column if exists wp_post_title;
