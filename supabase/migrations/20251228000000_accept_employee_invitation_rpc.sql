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
  v_now bigint;
  v_row_count integer;
begin
  v_now := (extract(epoch from now()) * 1000)::bigint;

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

  if v_invitation.owner_user_id = p_user_id then
    return query select false, 'Cannot accept own invitation';
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
     set updated_at = v_now
   where id = v_invitation.owner_user_id;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    raise exception 'Failed to update owner role';
  end if;

  return query select true, null::text;
end;
$$;

-- Rollback: drop function public.accept_employee_invitation(uuid, text);
