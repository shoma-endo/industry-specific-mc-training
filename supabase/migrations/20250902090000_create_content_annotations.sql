-- Content annotations: user-entered fields linked to WP posts
create table if not exists public.content_annotations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  wp_post_id bigint not null,
  canonical_url text,
  main_kw text,
  kw text,
  impressions text,
  persona text,
  needs text,
  goal text,
  updated_at timestamptz not null default now(),
  unique (user_id, wp_post_id)
);

create index if not exists idx_content_annotations_user_post on public.content_annotations(user_id, wp_post_id);
create index if not exists idx_content_annotations_canonical on public.content_annotations(canonical_url);


