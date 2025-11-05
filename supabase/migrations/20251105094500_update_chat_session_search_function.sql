-- Recreate search_chat_sessions RPC with URL exact match and title partial match
drop function if exists public.search_chat_sessions(text, text, integer);

create function public.search_chat_sessions(
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
  similarity_score double precision
)
language plpgsql
as $$
declare
  v_query text;
  v_tsquery tsquery;
  v_normalized_query text;
  v_limit integer := 20;
  v_has_tsquery boolean := false;
begin
  if p_limit is not null and p_limit > 0 then
    v_limit := p_limit;
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
             0::double precision as similarity_score
        from public.chat_sessions cs
        left join public.content_annotations ca
          on ca.session_id = cs.id
         and ca.user_id = cs.user_id
       where cs.user_id = p_user_id
       order by cs.last_message_at desc
       limit v_limit;
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
                 when cs.title ilike '%' || v_query || '%' then 0.5::double precision
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
           or cs.title ilike '%' || v_query || '%'
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
               when cs.title ilike '%' || v_query || '%' then 0.5::double precision
               else 0::double precision
             end as similarity_score
        from public.chat_sessions cs
        left join public.content_annotations ca
          on ca.session_id = cs.id
         and ca.user_id = cs.user_id
       where cs.user_id = p_user_id
         and (
           (v_normalized_query is not null and ca.normalized_url = v_normalized_query)
           or cs.title ilike '%' || v_query || '%'
         )
       order by similarity_score desc, cs.last_message_at desc
       limit v_limit;
  end;
end;
$$;

-- Rollback: drop function public.search_chat_sessions(text, text, integer);
