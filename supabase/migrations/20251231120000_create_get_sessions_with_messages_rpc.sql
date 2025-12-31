-- RPC関数: セッションとメッセージを一括取得（N+1問題を解消）
-- Rollback: DROP FUNCTION IF EXISTS public.get_sessions_with_messages(text, integer);

CREATE OR REPLACE FUNCTION public.get_sessions_with_messages(
  p_user_id text,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  session_id text,
  title text,
  last_message_at bigint,
  messages jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_limit integer := 20;
BEGIN
  -- limit パラメータの検証（1以上、最大100）
  IF p_limit IS NOT NULL AND p_limit > 0 AND p_limit <= 100 THEN
    v_limit := p_limit;
  END IF;

  RETURN QUERY
  WITH user_sessions AS (
    -- ユーザーのセッションを取得（最新順）
    SELECT
      cs.id,
      cs.title,
      cs.last_message_at
    FROM public.chat_sessions cs
    WHERE cs.user_id = p_user_id
    ORDER BY cs.last_message_at DESC
    LIMIT v_limit
  ),
  session_messages AS (
    -- 各セッションのメッセージを取得してJSON配列に集約
    SELECT
      cm.session_id,
      jsonb_agg(
        jsonb_build_object(
          'id', cm.id,
          'role', cm.role,
          'content', cm.content,
          'created_at', cm.created_at
        )
        ORDER BY cm.created_at ASC
      ) AS messages_json
    FROM public.chat_messages cm
    INNER JOIN user_sessions us ON cm.session_id = us.id
    WHERE cm.user_id = p_user_id
    GROUP BY cm.session_id
  )
  SELECT
    us.id AS session_id,
    us.title,
    us.last_message_at,
    COALESCE(sm.messages_json, '[]'::jsonb) AS messages
  FROM user_sessions us
  LEFT JOIN session_messages sm ON us.id = sm.session_id
  ORDER BY us.last_message_at DESC;
END;
$$;

-- 権限を付与
GRANT EXECUTE ON FUNCTION public.get_sessions_with_messages(text, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_sessions_with_messages(text, integer) TO authenticated;

