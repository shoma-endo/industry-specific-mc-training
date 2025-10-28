-- Ensure canonical_url is unique per user when present
create unique index if not exists idx_content_annotations_user_canonical_unique
  on public.content_annotations(user_id, canonical_url)
  where canonical_url is not null;

-- Rollback
-- drop index if exists idx_content_annotations_user_canonical_unique;
