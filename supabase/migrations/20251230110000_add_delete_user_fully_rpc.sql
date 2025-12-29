create or replace function public.delete_user_fully(
  p_user_id uuid
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

  if auth.uid() <> p_user_id and v_actor.role <> 'admin' then
    return query select false, 'Not authorized';
    return;
  end if;

  if not exists (select 1 from users where id = p_user_id) then
    return query select false, 'User not found';
    return;
  end if;

  delete from chat_messages where user_id = p_user_id::text;
  delete from chat_sessions where user_id = p_user_id::text;
  delete from content_annotations where user_id = p_user_id::text;
  delete from content_categories where user_id = p_user_id::text;
  delete from briefs where user_id = p_user_id::text;

  delete from users where id = p_user_id;

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
  v_now bigint;
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

  if auth.uid() <> p_owner_id and v_actor.role <> 'admin' then
    return query select false, 'Not authorized';
    return;
  end if;

  v_now := (extract(epoch from now()) * 1000)::bigint;

  select *
    into v_owner
    from users
   where id = p_owner_id
   for update;

  if not found then
    return query select false, 'Owner not found';
    return;
  end if;

  if v_owner.owner_user_id is not null then
    return query select false, 'Owner already belongs to an organization';
    return;
  end if;

  if v_owner.role <> 'owner' then
    return query select false, 'Owner role invalid';
    return;
  end if;

  if v_owner.owner_previous_role is not null then
    v_restored_role := v_owner.owner_previous_role;
  else
    v_restored_role := 'paid';
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

-- Rollback:
-- DROP FUNCTION IF EXISTS public.delete_employee_and_restore_owner(uuid, uuid);
-- DROP FUNCTION IF EXISTS public.delete_user_fully(uuid);
