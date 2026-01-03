-- Enable RLS and allow authenticated users to access their own annotations
alter table if exists public.content_annotations enable row level security;

drop policy if exists "content_annotations_select_own" on public.content_annotations;
drop policy if exists "content_annotations_insert_own" on public.content_annotations;
drop policy if exists "content_annotations_update_own" on public.content_annotations;
drop policy if exists "content_annotations_delete_own" on public.content_annotations;

create policy "content_annotations_select_own" on public.content_annotations
  for select
  using (auth.uid()::text = user_id);

create policy "content_annotations_insert_own" on public.content_annotations
  for insert
  with check (auth.uid()::text = user_id);

create policy "content_annotations_update_own" on public.content_annotations
  for update
  using (auth.uid()::text = user_id);

create policy "content_annotations_delete_own" on public.content_annotations
  for delete
  using (auth.uid()::text = user_id);

-- Rollback plan:
-- drop policy if exists "content_annotations_select_own" on public.content_annotations;
-- drop policy if exists "content_annotations_insert_own" on public.content_annotations;
-- drop policy if exists "content_annotations_update_own" on public.content_annotations;
-- drop policy if exists "content_annotations_delete_own" on public.content_annotations;
