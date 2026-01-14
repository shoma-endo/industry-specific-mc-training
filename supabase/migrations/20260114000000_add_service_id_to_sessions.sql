-- chat_sessions テーブルに service_id カラムを追加 (冪等性の確保)
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS service_id TEXT;

-- インデックスの追加によるクエリの高速化
CREATE INDEX IF NOT EXISTS idx_chat_sessions_service_id ON chat_sessions(service_id);

-- 既存のセッションを、そのユーザーの最初のサービスに紐づける (JOINによる高速化)
-- briefs.data->'services'->0->>'id' を取得して更新
UPDATE chat_sessions cs
SET service_id = b.first_service_id
FROM (
  SELECT DISTINCT ON (user_id) 
    user_id,
    data->'services'->0->>'id' as first_service_id
  FROM briefs
  WHERE data->'services'->0->>'id' IS NOT NULL
  ORDER BY user_id, created_at ASC
) b
WHERE cs.user_id = b.user_id
  AND cs.service_id IS NULL;

-- 外部キー制約についての検討:
-- 現在サービス情報は briefs テーブルの JSONB カラム内に存在するため、
-- 物理的な外部キー制約 (REFERENCES) を張ることはできません。
-- 将来的に services テーブルが独立した際に、以下の制約の追加を検討してください。
-- ALTER TABLE chat_sessions ADD CONSTRAINT fk_chat_sessions_service_id 
--   FOREIGN KEY (service_id) REFERENCES services(id);

-- 移行後の検証用クエリ:
-- SELECT COUNT(*) FROM chat_sessions WHERE service_id IS NULL;

-- =============================================================================
-- ROLLBACK 手順
-- =============================================================================
-- このマイグレーションをロールバックする場合は、以下のSQLを実行してください:
--
-- 1. インデックスの削除
-- DROP INDEX IF EXISTS idx_chat_sessions_service_id;
--
-- 2. service_id カラムの削除
-- ALTER TABLE chat_sessions DROP COLUMN IF EXISTS service_id;
--
-- 注意: ロールバックを実行すると、既存のセッションに紐づいた service_id 情報は
-- 完全に失われます。必要に応じて事前にバックアップを取得してください。
-- =============================================================================
