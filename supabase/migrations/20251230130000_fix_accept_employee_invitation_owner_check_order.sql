-- オーナー存在確認を更新前に移動（データ整合性の改善）
--
-- 問題: accept_employee_invitation 関数でオーナーの存在確認が、
--       ユーザーと招待レコードの更新後に行われていた。
--       オーナーが見つからない場合、部分的な更新がコミットされ、
--       データ不整合が発生する可能性があった。
--
-- 修正: オーナーの存在確認を更新前の検証フェーズに移動し、
--       すべての検証が完了してから更新を実行するように変更。

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

  -- オーナーの存在確認を先に行う（更新前に検証）
  select *
    into v_owner
    from users
   where id = v_invitation.owner_user_id
   for update;

  if not found then
    return query select false, 'Invitation owner not found';
    return;
  end if;

  -- すべての検証が完了したため、更新を実行
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

  -- オーナーのロール更新（v_ownerは既に取得済み）
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

-- Rollback:
-- 元のバージョン（20251230010000_add_owner_previous_role.sql）に戻す場合は、
-- 以下のコマンドを実行してください：
-- \i supabase/migrations/20251230010000_add_owner_previous_role.sql
