-- Create GSC daily metrics (fact table) and evaluation workflow tables
create extension if not exists pg_trgm;

-- Fact: daily metrics per URL
create table if not exists public.gsc_page_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  content_annotation_id uuid references public.content_annotations(id) on delete set null,
  property_uri text not null,
  search_type text not null default 'web' check (search_type in ('web', 'image', 'news')),
  date date not null,
  url text not null,
  normalized_url text generated always as (public.normalize_url(url)) stored,
  clicks integer not null default 0 check (clicks >= 0),
  impressions integer not null default 0 check (impressions >= 0),
  ctr numeric(6,4) not null default 0,
  position numeric(8,4) not null default 0,
  imported_at timestamptz not null default timezone('utc', now()),
  unique (user_id, property_uri, date, normalized_url, search_type)
);

create index if not exists idx_gsc_metrics_user_date
  on public.gsc_page_metrics(user_id, date desc);

create index if not exists idx_gsc_metrics_annotation_date
  on public.gsc_page_metrics(content_annotation_id, date desc);

create index if not exists idx_gsc_metrics_norm_trgm
  on public.gsc_page_metrics using gin (normalized_url gin_trgm_ops);

alter table public.gsc_page_metrics enable row level security;

create policy "gsc_page_metrics_select_own"
  on public.gsc_page_metrics
  for select
  using ((select auth.uid()) = user_id);

create policy "gsc_page_metrics_mutate_own"
  on public.gsc_page_metrics
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Evaluation summary per article (1 row per content_annotation)
create table if not exists public.gsc_article_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  content_annotation_id uuid not null references public.content_annotations(id) on delete cascade,
  property_uri text not null,
  current_stage smallint not null default 1 check (current_stage between 1 and 4),
  last_evaluated_on date,
  next_evaluation_on date not null,
  last_seen_position numeric(8,4),
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, content_annotation_id)
);

create index if not exists idx_gsc_article_evaluations_user_next
  on public.gsc_article_evaluations(user_id, next_evaluation_on);

create index if not exists idx_gsc_article_evaluations_property
  on public.gsc_article_evaluations(property_uri);

alter table public.gsc_article_evaluations enable row level security;

create policy "gsc_article_evaluations_select_own"
  on public.gsc_article_evaluations
  for select
  using ((select auth.uid()) = user_id);

create policy "gsc_article_evaluations_mutate_own"
  on public.gsc_article_evaluations
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Evaluation history (per run)
create table if not exists public.gsc_article_evaluation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  content_annotation_id uuid not null references public.content_annotations(id) on delete cascade,
  evaluation_date date not null,
  stage smallint not null check (stage between 1 and 4),
  previous_position numeric(8,4),
  current_position numeric(8,4) not null,
  outcome text not null check (outcome in ('improved', 'no_change', 'worse')),
  suggestion_applied boolean not null default false,
  suggestion_summary text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_gsc_article_eval_history_user_date
  on public.gsc_article_evaluation_history(user_id, evaluation_date desc);

create index if not exists idx_gsc_article_eval_history_annotation_date
  on public.gsc_article_evaluation_history(content_annotation_id, evaluation_date desc);

alter table public.gsc_article_evaluation_history enable row level security;

create policy "gsc_article_eval_history_select_own"
  on public.gsc_article_evaluation_history
  for select
  using ((select auth.uid()) = user_id);

create policy "gsc_article_eval_history_mutate_own"
  on public.gsc_article_evaluation_history
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Rollback instructions:
-- drop table if exists public.gsc_article_evaluation_history;
-- drop table if exists public.gsc_article_evaluations;
-- drop table if exists public.gsc_page_metrics;
