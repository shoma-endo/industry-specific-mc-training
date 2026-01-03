-- Follow-up fixes for RPCs after timestamptz migration

begin;

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
  last_message_at timestamptz,
  similarity_score double precision
)
language plpgsql
as $$
declare
  v_query text;
  v_tsquery tsquery;
  v_normalized_query text;
  v_escaped_query text;
  v_limit integer := 20;
  v_has_tsquery boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if auth.uid()::text <> p_user_id then
    raise exception 'Not authorized to access this user data';
  end if;

  if p_limit is not null and p_limit > 0 then
    v_limit := p_limit;
  end if;

  v_query := coalesce(trim(p_query), '');
  v_normalized_query := public.normalize_url(v_query);
  v_escaped_query := replace(replace(replace(v_query, '\\', '\\\\'), '%', '\\%'), '_', '\\_');

  if v_query = '' then
    return query
      select cs.id,
             cs.title,
             ca.canonical_url,
             ca.wp_post_title,
             cs.last_message_at,
             0::double precision as similarity_score
       from public.chat_sessions cs
       left join public.content_annotations ca
         on ca.session_id = cs.id
        and ca.user_id = cs.user_id
      where cs.user_id = p_user_id
      order by cs.last_message_at desc
      limit v_limit;
    return;
  end if;

  begin
    v_tsquery := websearch_to_tsquery('simple', v_query);
    v_has_tsquery := true;
  exception when others then
    v_tsquery := null;
    v_has_tsquery := false;
  end;

  begin
    return query
      select cs.id,
             cs.title,
             ca.canonical_url,
             ca.wp_post_title,
             cs.last_message_at,
             greatest(
               case when v_has_tsquery then ts_rank_cd(cs.search_vector, v_tsquery)::double precision else 0::double precision end,
               case
                 when v_normalized_query is not null and ca.normalized_url = v_normalized_query then 1.0::double precision
                 else 0::double precision
               end,
               case
                 when cs.title ilike '%' || v_escaped_query || '%' escape '\\' then 0.5::double precision
                 else 0::double precision
               end
             ) as similarity_score
        from public.chat_sessions cs
        left join public.content_annotations ca
          on ca.session_id = cs.id
         and ca.user_id = cs.user_id
       where cs.user_id = p_user_id
         and (
           (v_has_tsquery and cs.search_vector @@ v_tsquery)
           or (v_normalized_query is not null and ca.normalized_url = v_normalized_query)
           or cs.title ilike '%' || v_escaped_query || '%' escape '\\'
         )
       order by similarity_score desc, cs.last_message_at desc
       limit v_limit;
  exception when others then
    raise warning 'search_chat_sessions fallback: %', sqlerrm;
    return query
      select cs.id,
             cs.title,
             ca.canonical_url,
             ca.wp_post_title,
             cs.last_message_at,
             case
               when v_normalized_query is not null and ca.normalized_url = v_normalized_query then 1.0::double precision
               when cs.title ilike '%' || v_escaped_query || '%' escape '\\' then 0.5::double precision
               else 0::double precision
             end as similarity_score
        from public.chat_sessions cs
        left join public.content_annotations ca
          on ca.session_id = cs.id
         and ca.user_id = cs.user_id
       where cs.user_id = p_user_id
         and (
           (v_normalized_query is not null and ca.normalized_url = v_normalized_query)
           or cs.title ilike '%' || v_escaped_query || '%' escape '\\'
         )
       order by similarity_score desc, cs.last_message_at desc
       limit v_limit;
  end;
end;
$$;

create or replace function public.get_sessions_with_messages(
  p_user_id text,
  p_limit integer default 20
)
returns table (
  session_id text,
  title text,
  last_message_at timestamptz,
  messages jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := 20;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if auth.uid()::text <> p_user_id then
    raise exception 'Not authorized to access this user data';
  end if;

  if p_limit is not null and p_limit > 0 and p_limit <= 100 then
    v_limit := p_limit;
  end if;

  return query
  with user_sessions as (
    select
      cs.id,
      cs.title,
      cs.last_message_at
    from public.chat_sessions cs
    where cs.user_id = p_user_id
    order by cs.last_message_at desc
    limit v_limit
  ),
  session_messages as (
    select
      cm.session_id,
      jsonb_agg(
        jsonb_build_object(
          'id', cm.id,
          'role', cm.role,
          'content', cm.content,
          'created_at', cm.created_at
        )
        order by cm.created_at asc
      ) as messages_json
    from public.chat_messages cm
    inner join user_sessions us on cm.session_id = us.id
    where cm.user_id = p_user_id
    group by cm.session_id
  )
  select
    us.id as session_id,
    us.title,
    us.last_message_at,
    coalesce(sm.messages_json, '[]'::jsonb) as messages
  from user_sessions us
  left join session_messages sm on us.id = sm.session_id
  order by us.last_message_at desc;
end;
$$;

revoke execute on function public.get_sessions_with_messages(text, integer) from anon;
grant execute on function public.get_sessions_with_messages(text, integer) to authenticated;

commit;

-- Rollback plan (execute manually):
-- 1) Restore RPCs to previous definitions from 20260101000000_normalize_timestamps_to_timestamptz.sql.
-- 2) Grant execute on public.get_sessions_with_messages(text, integer) to anon if needed.
-- 3) Drop this migration's replacements if reverting:
--    drop function if exists public.search_chat_sessions(text, text, integer);
--    drop function if exists public.get_sessions_with_messages(text, integer);
