-- データベース統計情報取得用のRPC関数を作成
-- 容量情報を取得するための関数

-- データベース全体のサイズを取得する関数
CREATE OR REPLACE FUNCTION get_database_size()
RETURNS TABLE (
  database_size_pretty TEXT,
  database_size_bytes BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    pg_size_pretty(pg_database_size(current_database())) AS database_size_pretty,
    pg_database_size(current_database()) AS database_size_bytes;
$$;

-- テーブルごとのサイズを取得する関数
-- table_namesがNULLまたは空配列の場合は、publicスキーマ内の全テーブルを取得
CREATE OR REPLACE FUNCTION get_table_sizes(table_names TEXT[] DEFAULT NULL)
RETURNS TABLE (
  table_name TEXT,
  size_pretty TEXT,
  size_bytes BIGINT
)
LANGUAGE sql
STABLE
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

-- 権限を付与
GRANT EXECUTE ON FUNCTION get_database_size() TO anon;
GRANT EXECUTE ON FUNCTION get_database_size() TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_sizes(TEXT[]) TO anon;
GRANT EXECUTE ON FUNCTION get_table_sizes(TEXT[]) TO authenticated;

