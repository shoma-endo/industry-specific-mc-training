-- データベース統計情報取得用のRPC関数の修飾子を修正
-- STABLE -> VOLATILE に変更してキャッシュを無効化
--
-- 問題: STABLE修飾子により、同一トランザクション内で古いキャッシュデータが返される
-- 解決: VOLATILE修飾子に変更して、常に最新のデータベース統計を取得する
--
-- ロールバック方法:
-- DROP FUNCTION IF EXISTS get_database_size();
-- DROP FUNCTION IF EXISTS get_table_sizes(TEXT[]);
-- その後、20251107000000_create_database_stats_functions.sql を再実行

-- データベース全体のサイズを取得する関数（VOLATILE に変更）
CREATE OR REPLACE FUNCTION get_database_size()
RETURNS TABLE (
  database_size_pretty TEXT,
  database_size_bytes BIGINT
)
LANGUAGE sql
VOLATILE  -- STABLE から VOLATILE に変更
SECURITY DEFINER
AS $$
  SELECT
    pg_size_pretty(pg_database_size(current_database())) AS database_size_pretty,
    pg_database_size(current_database()) AS database_size_bytes;
$$;

-- テーブルごとのサイズを取得する関数（VOLATILE に変更）
CREATE OR REPLACE FUNCTION get_table_sizes(table_names TEXT[] DEFAULT NULL)
RETURNS TABLE (
  table_name TEXT,
  size_pretty TEXT,
  size_bytes BIGINT
)
LANGUAGE sql
VOLATILE  -- STABLE から VOLATILE に変更
SECURITY DEFINER
AS $$
  SELECT
    tablename::TEXT AS table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size_pretty,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
  FROM pg_tables
  WHERE schemaname = 'public'
    AND (table_names IS NULL OR array_length(table_names, 1) IS NULL OR tablename = ANY(table_names))
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
$$;

-- 権限は既に付与されているため再付与は不要
-- （CREATE OR REPLACE では権限が保持される）
