-- Move staff-owned chat data to the owner user_id (staff invitations only)
BEGIN;

-- 1. chat_sessions の user_id を移行
UPDATE public.chat_sessions cs
SET user_id = CAST(u.owner_user_id AS TEXT)
FROM public.users u
WHERE CAST(cs.user_id AS TEXT) = CAST(u.id AS TEXT)
  AND u.owner_user_id IS NOT NULL;

-- 2. chat_messages の user_id を移行
UPDATE public.chat_messages cm
SET user_id = CAST(u.owner_user_id AS TEXT)
FROM public.users u,
     public.chat_sessions cs
WHERE CAST(cm.session_id AS TEXT) = CAST(cs.id AS TEXT)
  AND CAST(cm.user_id AS TEXT) = CAST(u.id AS TEXT)
  AND CAST(cs.user_id AS TEXT) = CAST(u.owner_user_id AS TEXT)
  AND u.owner_user_id IS NOT NULL;

-- 3. content_annotations の user_id を移行
-- 型エラーを確実に回避するため、一時テーブルを使用してデータを整理します
CREATE TEMP TABLE tmp_eligible_annotations AS
SELECT 
  ca.id AS annotation_id, 
  u.owner_user_id
FROM public.content_annotations ca
JOIN public.users u ON CAST(ca.user_id AS TEXT) = CAST(u.id AS TEXT)
WHERE u.owner_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.content_annotations ca2 
    WHERE CAST(ca2.user_id AS TEXT) = CAST(u.owner_user_id AS TEXT) 
      AND ca2.wp_post_id = ca.wp_post_id
  )
  AND (
    ca.canonical_url IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.content_annotations ca2 
      WHERE CAST(ca2.user_id AS TEXT) = CAST(u.owner_user_id AS TEXT) 
        AND ca2.canonical_url = ca.canonical_url
    )
  );

UPDATE public.content_annotations ca
SET user_id = CAST(t.owner_user_id AS TEXT)
FROM tmp_eligible_annotations t
WHERE ca.id = t.annotation_id;

DROP TABLE tmp_eligible_annotations;

COMMIT;

-- Rollback:
-- データ移行のため自動ロールバック不可。必要に応じて事前バックアップから復元してください。
