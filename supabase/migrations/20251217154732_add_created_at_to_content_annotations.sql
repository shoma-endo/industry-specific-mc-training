-- Add created_at to content_annotations for accurate ingestion timestamps
alter table if exists public.content_annotations
  add column if not exists created_at timestamptz not null default timezone('utc', now());

-- Backfill existing rows where created_at was missing by copying updated_at
update public.content_annotations
  set created_at = coalesce(created_at, updated_at, timezone('utc', now()))
  where created_at is null;

-- Rollback
-- alter table if exists public.content_annotations drop column if exists created_at;
