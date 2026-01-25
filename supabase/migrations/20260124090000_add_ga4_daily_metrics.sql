-- GA4 daily metrics cache (MVP)

-- URL path normalization for GA4 pagePath join
create or replace function public.normalize_to_path(input_text text)
returns text
language plpgsql
immutable
as $$
declare
  raw text;
  stripped text;
  path_candidate text;
  cleaned text;
  normalized text;
begin
  if input_text is null then
    return '/';
  end if;

  raw := lower(trim(input_text));
  if raw = '' then
    return '/';
  end if;

  -- remove protocol and www
  stripped := regexp_replace(raw, '^https?://', '');
  stripped := regexp_replace(stripped, '^www\.', '');

  if stripped ~ '^[?#]' then
    return '/';
  end if;

  if stripped like '/%' then
    path_candidate := stripped;
  elsif position('/' in stripped) > 0 then
    path_candidate := substr(stripped, position('/' in stripped));
  else
    -- domain only or empty
    return '/';
  end if;

  cleaned := split_part(path_candidate, '#', 1);
  cleaned := split_part(cleaned, '?', 1);

  if cleaned = '' then
    return '/';
  end if;

  normalized := regexp_replace(cleaned, '/+$', '');

  if normalized = '' then
    return '/';
  end if;

  if normalized = '/' then
    return '/';
  end if;

  return normalized;
end;
$$;
-- Rollback: drop function if exists public.normalize_to_path;

-- Extend gsc_credentials with GA4 settings
alter table public.gsc_credentials
  add column if not exists ga4_property_id text;
-- Rollback: alter table public.gsc_credentials drop column if exists ga4_property_id;

alter table public.gsc_credentials
  add column if not exists ga4_property_name text;
-- Rollback: alter table public.gsc_credentials drop column if exists ga4_property_name;

alter table public.gsc_credentials
  add column if not exists ga4_conversion_events text[];
-- Rollback: alter table public.gsc_credentials drop column if exists ga4_conversion_events;

alter table public.gsc_credentials
  add column if not exists ga4_threshold_engagement_sec integer;
-- Rollback: alter table public.gsc_credentials drop column if exists ga4_threshold_engagement_sec;

alter table public.gsc_credentials
  add column if not exists ga4_threshold_read_rate numeric(3,2);
-- Rollback: alter table public.gsc_credentials drop column if exists ga4_threshold_read_rate;

alter table public.gsc_credentials
  add column if not exists ga4_last_synced_at timestamptz;
-- Rollback: alter table public.gsc_credentials drop column if exists ga4_last_synced_at;

comment on column public.gsc_credentials.ga4_property_id is 'GA4 property resource name (properties/123)';
comment on column public.gsc_credentials.ga4_property_name is 'GA4 property display name';
comment on column public.gsc_credentials.ga4_conversion_events is 'GA4 key event names for CV';
comment on column public.gsc_credentials.ga4_threshold_engagement_sec is 'Engagement time threshold (sec)';
comment on column public.gsc_credentials.ga4_threshold_read_rate is 'Read rate threshold (0-1)';
comment on column public.gsc_credentials.ga4_last_synced_at is 'Last GA4 sync timestamp';

-- GA4 daily page metrics
create table if not exists public.ga4_page_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  property_id text not null,
  date date not null,
  page_path text not null,
  normalized_path text generated always as (public.normalize_to_path(page_path)) stored,
  sessions integer not null default 0 check (sessions >= 0),
  users integer not null default 0 check (users >= 0),
  engagement_time_sec integer not null default 0 check (engagement_time_sec >= 0),
  bounce_rate numeric(5,4) not null default 0,
  cv_event_count integer not null default 0 check (cv_event_count >= 0),
  scroll_90_event_count integer not null default 0 check (scroll_90_event_count >= 0),
  is_sampled boolean not null default false,
  is_partial boolean not null default false,
  imported_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, property_id, date, page_path)
);
-- Rollback: drop table if exists public.ga4_page_metrics_daily;

create index if not exists idx_ga4_metrics_user_date
  on public.ga4_page_metrics_daily(user_id, date desc);
-- Rollback: drop index if exists idx_ga4_metrics_user_date;

create index if not exists idx_ga4_metrics_user_property
  on public.ga4_page_metrics_daily(user_id, property_id);
-- Rollback: drop index if exists idx_ga4_metrics_user_property;

create index if not exists idx_ga4_metrics_norm_trgm
  on public.ga4_page_metrics_daily using gin (normalized_path gin_trgm_ops);
-- Rollback: drop index if exists idx_ga4_metrics_norm_trgm;

alter table public.ga4_page_metrics_daily enable row level security;

create policy "ga4_page_metrics_daily_select_own_or_owner"
  on public.ga4_page_metrics_daily
  for select
  using (user_id = any(get_accessible_user_ids((select auth.uid()))));
-- Rollback: drop policy if exists "ga4_page_metrics_daily_select_own_or_owner" on public.ga4_page_metrics_daily;

-- Service Role専用のため、明示的な書き込みポリシーは作成しない
