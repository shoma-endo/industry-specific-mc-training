-- user_id にユニーク制約を追加
-- 既存データがある場合に備えて、重複データを削除してから制約を追加

-- 重複データがある場合は古いレコードを削除（最新のupdated_atを保持）
DELETE FROM briefs a USING briefs b 
WHERE a.user_id = b.user_id 
AND a.updated_at < b.updated_at;

-- ユニーク制約を追加
ALTER TABLE briefs ADD CONSTRAINT briefs_user_id_unique UNIQUE (user_id);

-- コメント
COMMENT ON CONSTRAINT briefs_user_id_unique ON briefs IS 'ユーザーごとに1つの事業者情報のみ許可';
