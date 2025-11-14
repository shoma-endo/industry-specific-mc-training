create table if not exists public.gsc_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  google_account_email text,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamp with time zone,
  scope text[],
  property_uri text,
  property_type text check (
    property_type in ('sc-domain', 'url-prefix')
  ),
  property_display_name text,
  permission_level text,
  verified boolean default false,
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now()),
  constraint gsc_credentials_user_id_key unique (user_id),
  constraint gsc_credentials_user_id_fkey foreign key (user_id)
    references public.users(id) on delete cascade
);

comment on table public.gsc_credentials is 'Google Search Console OAuth資格情報';
comment on column public.gsc_credentials.google_account_email is '接続されたGoogleアカウントのメールアドレス';
comment on column public.gsc_credentials.property_uri is 'Search ConsoleのプロパティURI (sc-domain:example.com 等)';
comment on column public.gsc_credentials.property_type is 'プロパティ種別 (sc-domain / url-prefix)';
comment on column public.gsc_credentials.permission_level is 'Google Search Console上の権限レベル';

alter table public.gsc_credentials enable row level security;

create policy "gsc_credentials_select_own"
  on public.gsc_credentials
  for select
  using ((select auth.uid()) = user_id);

create policy "gsc_credentials_mutate_own"
  on public.gsc_credentials
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Rollback instructions:
-- drop table if exists public.gsc_credentials;
