-- Fix delete_employee_and_restore_owner to allow service_role execution without auth.uid()
-- This fixes the 'Not authenticated' error when deleting employees from the server side.

CREATE OR REPLACE FUNCTION public.delete_employee_and_restore_owner(
  p_employee_id uuid,
  p_owner_id uuid
)
RETURNS TABLE (
  success boolean,
  error text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor users%rowtype;
  v_owner users%rowtype;
  v_employee users%rowtype;
  v_row_count integer;
  v_now timestamptz;
  v_restored_role text;
  v_delete_result record;
BEGIN
  -- 認証・認可チェック
  IF auth.uid() IS NULL THEN
    -- Service Role で実行されている場合、PostgRESTを経由すると session_user は 'authenticator' になります
    IF session_user NOT IN ('service_role', 'authenticator') THEN
      RETURN QUERY SELECT false, 'Not authenticated - session_user: ' || session_user;
      RETURN;
    END IF;
    -- 特権実行の場合は認可チェックをスキップ
  ELSE
    -- 通常ユーザーの場合は本人確認または管理者確認
    SELECT * INTO v_actor FROM users WHERE id = auth.uid();
    IF NOT FOUND THEN
      RETURN QUERY SELECT false, 'Actor not found';
      RETURN;
    END IF;

    IF auth.uid() <> p_owner_id AND v_actor.role <> 'admin' THEN
      RETURN QUERY SELECT false, 'Not authorized';
      RETURN;
    END IF;
  END IF;

  -- オーナーの存在確認とロック
  SELECT *
    INTO v_owner
    FROM users
   WHERE id = p_owner_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Owner not found';
    RETURN;
  END IF;

  IF v_owner.role <> 'owner' THEN
    RETURN QUERY SELECT false, 'Target user is not an owner';
    RETURN;
  END IF;

  -- 従業員との紐付け確認
  SELECT *
    INTO v_employee
    FROM users
   WHERE id = p_employee_id
     AND owner_user_id = p_owner_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Employee not found or not linked to this owner';
    RETURN;
  END IF;

  -- 従業員データの完全削除（auth.users 以外）
  SELECT *
    INTO v_delete_result
    FROM public.delete_user_fully(p_employee_id);

  IF v_delete_result.success IS DISTINCT FROM true THEN
    RETURN QUERY SELECT false, COALESCE(v_delete_result.error, 'Failed to delete employee data');
    RETURN;
  END IF;

  -- オーナーの状態を復帰
  v_now := now();
  
  -- Restore original role (admin or paid) from owner_previous_role.
  -- Defaults to 'paid' only if the original role was not recorded.
  IF v_owner.owner_previous_role IS NOT NULL THEN
    v_restored_role := v_owner.owner_previous_role;
  ELSE
    v_restored_role := 'paid';
  END IF;

  UPDATE users
     SET role = v_restored_role,
         owner_user_id = null,
         owner_previous_role = null,
         updated_at = v_now
   WHERE id = p_owner_id;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count = 0 THEN
    RAISE EXCEPTION 'Failed to restore owner state';
  END IF;

  RETURN QUERY SELECT true, null::text;
END;
$$;
