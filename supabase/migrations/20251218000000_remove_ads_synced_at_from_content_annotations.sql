-- Remove ads_synced_at column from content_annotations
-- This field was left behind when ads_headline and ads_description were removed
alter table if exists public.content_annotations
  drop column if exists ads_synced_at;

-- Rollback
-- alter table if exists public.content_annotations
--   add column if not exists ads_synced_at timestamptz null;
