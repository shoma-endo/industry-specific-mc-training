-- Enable trigram extension for fuzzy URL matching (idempotent)
create extension if not exists pg_trgm;

-- Immutable helper to normalize URLs for comparison/search
create or replace function public.normalize_url(url text)
returns text
language sql
immutable
as $$
  select case
    when url is null then null
    else regexp_replace(
      regexp_replace(
        regexp_replace(lower(url), '^https?://', ''),
        '^www\.',
        ''
      ),
      '/+$',
      ''
    )
  end
$$;
-- Rollback: drop function public.normalize_url;

-- Ensure content_annotations has a session reference (aligns chat <-> WP linkage)
alter table if exists public.content_annotations
  add column if not exists session_id text references public.chat_sessions(id) on delete cascade;
-- Rollback: alter table if exists public.content_annotations drop column if exists session_id;

create index if not exists idx_content_annotations_session
  on public.content_annotations(session_id);
-- Rollback: drop index if exists idx_content_annotations_session;

-- Store normalized URL for search (generated for consistency)
alter table if exists public.content_annotations
  add column if not exists normalized_url text generated always as (public.normalize_url(canonical_url)) stored;
-- Rollback: alter table if exists public.content_annotations drop column if exists normalized_url;

create unique index if not exists idx_content_annotations_session_unique
  on public.content_annotations(session_id)
  where session_id is not null;
-- Rollback: drop index if exists idx_content_annotations_session_unique;

create index if not exists idx_content_annotations_normalized_trgm
  on public.content_annotations using gin (normalized_url gin_trgm_ops);
-- Rollback: drop index if exists idx_content_annotations_normalized_trgm;

-- Search vector column for chat_sessions (kept in sync by triggers)
alter table if exists public.chat_sessions
  add column if not exists search_vector tsvector;
-- Rollback: alter table if exists public.chat_sessions drop column if exists search_vector;

create index if not exists idx_chat_sessions_search_vector
  on public.chat_sessions using gin (search_vector);
-- Rollback: drop index if exists idx_chat_sessions_search_vector;

-- Trigger to populate search_vector whenever chat_sessions rows change
create or replace function public.chat_sessions_set_search_vector()
returns trigger
language plpgsql
as $$
declare
  v_normalized text;
  v_wp_title text;
begin
  select ca.normalized_url, ca.wp_post_title
    into v_normalized, v_wp_title
  from public.content_annotations ca
  where ca.session_id = new.id
    and ca.user_id = new.user_id
  order by ca.updated_at desc
  limit 1;

  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(v_wp_title, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(v_normalized, '')), 'C');

  return new;
end;
$$;
-- Rollback: drop function public.chat_sessions_set_search_vector cascade;

drop trigger if exists trg_chat_sessions_search_vector on public.chat_sessions;
create trigger trg_chat_sessions_search_vector
  before insert or update on public.chat_sessions
  for each row
  execute function public.chat_sessions_set_search_vector();
-- Rollback: drop trigger if exists trg_chat_sessions_search_vector on public.chat_sessions;

-- Trigger hook to refresh search_vector when related annotations change
create or replace function public.refresh_chat_session_search_vector_from_annotation()
returns trigger
language plpgsql
as $$
declare
  target_session text;
begin
  target_session := coalesce(new.session_id, old.session_id);
  if target_session is null then
    return null;
  end if;

  update public.chat_sessions cs
     set search_vector = coalesce(
       (
         select setweight(to_tsvector('simple', coalesce(cs.title, '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(ca.wp_post_title, '')), 'B') ||
                setweight(to_tsvector('simple', coalesce(ca.normalized_url, '')), 'C')
           from public.content_annotations ca
          where ca.session_id = cs.id
            and ca.user_id = cs.user_id
          order by ca.updated_at desc
          limit 1
       ),
       setweight(to_tsvector('simple', coalesce(cs.title, '')), 'A')
     )
   where cs.id = target_session;

  return null;
end;
$$;
-- Rollback: drop function public.refresh_chat_session_search_vector_from_annotation cascade;

drop trigger if exists trg_content_annotations_refresh_search on public.content_annotations;
create trigger trg_content_annotations_refresh_search
  after insert or update or delete on public.content_annotations
  for each row
  execute function public.refresh_chat_session_search_vector_from_annotation();
-- Rollback: drop trigger if exists trg_content_annotations_refresh_search on public.content_annotations;

-- Backfill existing rows
update public.chat_sessions
   set title = title;

-- RPC to search chat sessions by title/URL
create or replace function public.search_chat_sessions(
  p_user_id text,
  p_query text,
  p_limit integer default 20
)
returns table (
  session_id text,
  title text,
  canonical_url text,
  wp_post_title text,
  last_message_at bigint,
  similarity_score numeric
)
language plpgsql
as $$
declare
  v_query text;
  v_tsquery tsquery;
  v_normalized_query text;
begin
  if p_limit is null or p_limit <= 0 then
    p_limit := 20;
  end if;

  v_query := coalesce(trim(p_query), '');
  v_normalized_query := public.normalize_url(v_query);

  if v_query = '' then
    return query
      select cs.id,
             cs.title,
             ca.canonical_url,
             ca.wp_post_title,
             cs.last_message_at,
             0::numeric as similarity_score
        from public.chat_sessions cs
        left join public.content_annotations ca
          on ca.session_id = cs.id
         and ca.user_id = cs.user_id
       where cs.user_id = p_user_id
       order by cs.last_message_at desc
       limit p_limit;
  end if;

  v_tsquery := websearch_to_tsquery('simple', v_query);

  return query
    select cs.id,
           cs.title,
           ca.canonical_url,
           ca.wp_post_title,
           cs.last_message_at,
           greatest(
             ts_rank_cd(cs.search_vector, v_tsquery),
             case
               when v_normalized_query is null or v_normalized_query = '' or ca.normalized_url is null then 0
               else similarity(ca.normalized_url, v_normalized_query)
             end
           ) as similarity_score
      from public.chat_sessions cs
      left join public.content_annotations ca
        on ca.session_id = cs.id
       and ca.user_id = cs.user_id
     where cs.user_id = p_user_id
       and (
         cs.search_vector @@ v_tsquery
         or (
           v_normalized_query is not null
           and v_normalized_query <> ''
           and ca.normalized_url is not null
           and ca.normalized_url % v_normalized_query
         )
       )
     order by similarity_score desc, cs.last_message_at desc
     limit p_limit;
end;
$$;
-- Rollback: drop function public.search_chat_sessions;
