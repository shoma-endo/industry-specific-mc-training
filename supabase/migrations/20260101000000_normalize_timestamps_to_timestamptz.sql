-- Normalize bigint timestamp columns to timestamptz (UTC)
alter table if exists public.briefs
  alter column created_at type timestamptz using to_timestamp(created_at / 1000.0),
  alter column updated_at type timestamptz using to_timestamp(updated_at / 1000.0);

alter table if exists public.chat_sessions
  alter column created_at type timestamptz using to_timestamp(created_at / 1000.0),
  alter column last_message_at type timestamptz using to_timestamp(last_message_at / 1000.0);

alter table if exists public.chat_messages
  alter column created_at type timestamptz using to_timestamp(created_at / 1000.0);

alter table if exists public.users
  alter column created_at type timestamptz using to_timestamp(created_at / 1000.0),
  alter column updated_at type timestamptz using to_timestamp(updated_at / 1000.0),
  alter column last_login_at type timestamptz
    using case
      when last_login_at is null then null
      else to_timestamp(last_login_at / 1000.0)
    end;

alter table if exists public.employee_invitations
  alter column created_at drop default;

alter table if exists public.employee_invitations
  alter column created_at type timestamptz using to_timestamp(created_at / 1000.0),
  alter column expires_at type timestamptz using to_timestamp(expires_at / 1000.0),
  alter column used_at type timestamptz
    using case
      when used_at is null then null
      else to_timestamp(used_at / 1000.0)
    end;

alter table if exists public.employee_invitations
  alter column created_at set default now();

comment on column public.employee_invitations.expires_at is '招待の有効期限（UTC）';
comment on column public.employee_invitations.used_at is '招待使用時刻（UTC）';
comment on column public.employee_invitations.created_at is '招待作成時刻（UTC）';

-- Update invitation RPC for timestamptz
create or replace function public.accept_employee_invitation(
  p_user_id uuid,
  p_token text
)
returns table (
  success boolean,
  error text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation employee_invitations%rowtype;
  v_user users%rowtype;
  v_owner users%rowtype;
  v_now timestamptz;
  v_row_count integer;
begin
  v_now := now();

  select *
    into v_invitation
    from employee_invitations
   where invitation_token = p_token
   for update;

  if not found then
    return query select false, 'Invitation not found';
    return;
  end if;

  if v_invitation.used_at is not null or v_invitation.expires_at < v_now then
    return query select false, 'Invitation expired or used';
    return;
  end if;

  select *
    into v_user
    from users
   where id = p_user_id
   for update;

  if not found then
    return query select false, 'User not found';
    return;
  end if;

  if v_user.owner_user_id is not null then
    return query select false, 'User already belongs to an organization';
    return;
  end if;

  if v_invitation.owner_user_id = p_user_id then
    return query select false, 'Cannot accept own invitation';
    return;
  end if;

  select *
    into v_owner
    from users
   where id = v_invitation.owner_user_id
   for update;

  if not found then
    return query select false, 'Invitation owner not found';
    return;
  end if;

  update users
     set role = 'paid',
         owner_user_id = v_invitation.owner_user_id,
         updated_at = v_now
   where id = p_user_id;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    raise exception 'Failed to update user';
  end if;

  update employee_invitations
     set used_at = v_now,
         used_by_user_id = p_user_id
   where id = v_invitation.id;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    raise exception 'Failed to mark invitation as used';
  end if;

  update users
     set role = 'owner',
         owner_previous_role = case
           when v_owner.role = 'owner' then v_owner.owner_previous_role
           else v_owner.role
         end,
         updated_at = v_now
   where id = v_owner.id;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    raise exception 'Failed to update owner role';
  end if;

  return query select true, null::text;
end;
$$;

create or replace function public.delete_employee_and_restore_owner(
  p_employee_id uuid,
  p_owner_id uuid
)
returns table (
  success boolean,
  error text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_owner users%rowtype;
  v_employee users%rowtype;
  v_row_count integer;
  v_now timestamptz;
  v_restored_role text;
  v_delete_result record;
begin
  if auth.uid() is null then
    return query select false, 'Not authenticated';
    return;
  end if;

  select *
    into v_actor
    from users
   where id = auth.uid();

  if not found then
    return query select false, 'Actor not found';
    return;
  end if;

  select *
    into v_owner
    from users
   where id = p_owner_id
   for update;

  if not found then
    return query select false, 'Owner not found';
    return;
  end if;

  if v_owner.role <> 'owner' then
    return query select false, 'Owner role not valid';
    return;
  end if;

  if auth.uid() <> p_owner_id and v_actor.role <> 'admin' then
    return query select false, 'Not authorized';
    return;
  end if;

  select *
    into v_employee
    from users
   where id = p_employee_id
     and owner_user_id = p_owner_id
   for update;

  if not found then
    return query select false, 'Employee not found or not linked';
    return;
  end if;

  select *
    into v_delete_result
    from public.delete_user_fully(p_employee_id);

  if v_delete_result.success is distinct from true then
    return query select false, coalesce(v_delete_result.error, 'Failed to delete employee');
    return;
  end if;

  v_now := now();

  v_restored_role := coalesce(v_owner.owner_previous_role, 'paid');

  update users
     set role = v_restored_role,
         owner_user_id = null,
         owner_previous_role = null,
         updated_at = v_now
   where id = p_owner_id;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    raise exception 'Failed to restore owner';
  end if;

  return query select true, null::text;
end;
$$;

-- Update chat session RPCs for timestamptz
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
  last_message_at timestamptz,
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

drop function if exists public.get_sessions_with_messages(text, integer);
create function public.get_sessions_with_messages(
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
as $$
declare
  v_limit integer := 20;
begin
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

grant execute on function public.get_sessions_with_messages(text, integer) to anon;
grant execute on function public.get_sessions_with_messages(text, integer) to authenticated;

-- Rollback plan:
-- Convert timestamptz columns back to bigint epoch milliseconds and restore old RPCs.
