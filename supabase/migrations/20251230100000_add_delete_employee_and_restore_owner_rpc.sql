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
  v_owner users%rowtype;
  v_row_count integer;
  v_now bigint;
  v_restored_role text;
begin
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

  delete from users
   where id = p_employee_id
     and owner_user_id = p_owner_id;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    return query select false, 'Employee not found or not linked';
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
