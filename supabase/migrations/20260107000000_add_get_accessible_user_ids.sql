-- Add get_accessible_user_ids helper function for owner/staff data access
-- Returns text[] for compatibility with existing RLS policies

CREATE OR REPLACE FUNCTION public.get_accessible_user_ids(p_user_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_owner_user_id uuid;
BEGIN
  -- ユーザーのowner_user_idを取得
  SELECT owner_user_id INTO v_owner_user_id
  FROM public.users
  WHERE id = p_user_id;

  -- ユーザーが存在しない場合
  IF NOT FOUND THEN
    RETURN ARRAY[]::text[];
  END IF;

  -- owner_user_idがある場合は[自分, オーナー]を、ない場合は[自分, 従業員...]を返す
  IF v_owner_user_id IS NOT NULL THEN
    -- 従業員: [自分, オーナー]を返す
    RETURN ARRAY[p_user_id::text, v_owner_user_id::text];
  ELSE
    -- オーナー: [自分, 従業員1, 従業員2, ...]を返す
    RETURN (
      SELECT array_agg(id::text)
      FROM (
        SELECT p_user_id AS id
        UNION
        SELECT id
        FROM public.users
        WHERE owner_user_id = p_user_id
      ) AS ids
    );
  END IF;
END;
$$;

-- Rollback:
-- DROP FUNCTION IF EXISTS public.get_accessible_user_ids(uuid);
