-- Enable trigram search for query_normalized indexes
create extension if not exists pg_trgm with schema public;

create table if not exists public.gsc_query_metrics (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    property_uri text not null,
    property_type text not null check (property_type in ('sc-domain', 'url-prefix')),
    search_type text not null check (search_type in ('web', 'image', 'video', 'news')),
    date date not null,
    url text not null,
    normalized_url text not null,
    query text not null,
    query_normalized text not null,
    clicks integer not null check (clicks >= 0),
    impressions integer not null check (impressions >= 0),
    ctr numeric(6,4) not null default 0 check (ctr >= 0 and ctr <= 1),
    position numeric(6,2) not null default 0 check (position >= 0),
    content_annotation_id uuid references public.content_annotations(id) on delete set null,
    imported_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint gsc_query_metrics_unique unique (user_id, property_uri, date, normalized_url, query_normalized, search_type)
);

create index if not exists idx_gsc_query_metrics_page
    on public.gsc_query_metrics (user_id, property_uri, normalized_url, search_type, date desc);

create index if not exists idx_gsc_query_metrics_query
    on public.gsc_query_metrics (user_id, property_uri, query_normalized, search_type, date desc);

create index if not exists idx_gsc_query_metrics_query_trgm
    on public.gsc_query_metrics using gin (query_normalized gin_trgm_ops);

alter table public.gsc_query_metrics enable row level security;

create policy "gsc_query_metrics_select_own"
  on public.gsc_query_metrics
  for select
  using ((select auth.uid()) = user_id);

create policy "gsc_query_metrics_mutate_own"
  on public.gsc_query_metrics
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

comment on table public.gsc_query_metrics is 'Page x query Search Console metrics.';
