create table public.sanity_projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  project_id text not null,
  dataset text not null,
  created_at timestamp with time zone default timezone('utc', now()),

  constraint sanity_projects_user_id_key unique (user_id),

  constraint sanity_projects_user_id_fkey foreign key (user_id)
    references public.users(id) on delete cascade
);

-- Row Level Securityの有効化
alter table public.sanity_projects enable row level security;

-- ユーザー自身のみデータ参照可能
create policy "ユーザー自身のみ参照可能"
  on public.sanity_projects
  for select
  using ((select auth.uid()) = user_id);

-- ユーザー自身のみデータ登録可能
create policy "ユーザー自身のみ登録可能"
  on public.sanity_projects
  for insert
  with check ((select auth.uid()) = user_id); 