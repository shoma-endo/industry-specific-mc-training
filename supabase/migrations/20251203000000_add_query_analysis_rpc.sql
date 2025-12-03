-- GSCクエリ分析用RPC関数
-- DB側で集計・期間比較を行い、パフォーマンスを大幅に改善
-- Rollback: DROP FUNCTION IF EXISTS public.get_gsc_query_analysis;

CREATE OR REPLACE FUNCTION public.get_gsc_query_analysis(
  p_user_id UUID,
  p_property_uri TEXT,
  p_normalized_url TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_comp_start_date DATE,
  p_comp_end_date DATE
)
RETURNS TABLE (
  query TEXT,
  query_normalized TEXT,
  clicks BIGINT,
  impressions BIGINT,
  avg_ctr NUMERIC,
  avg_position NUMERIC,
  position_change NUMERIC,
  clicks_change BIGINT,
  word_count INT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH current_period AS (
    -- 現在期間の集計
    SELECT
      gqm.query AS q,
      gqm.query_normalized AS qn,
      SUM(gqm.clicks)::BIGINT AS total_clicks,
      SUM(gqm.impressions)::BIGINT AS total_impressions,
      AVG(gqm.ctr) AS avg_ctr_val,
      AVG(gqm.position) AS avg_position_val,
      COUNT(*)::INT AS row_count
    FROM gsc_query_metrics gqm
    WHERE gqm.user_id = p_user_id
      AND gqm.property_uri = p_property_uri
      AND gqm.normalized_url = p_normalized_url
      AND gqm.date >= p_start_date
      AND gqm.date <= p_end_date
    GROUP BY gqm.query, gqm.query_normalized
  ),
  comparison_period AS (
    -- 比較期間の集計
    SELECT
      gqm.query_normalized AS qn,
      SUM(gqm.clicks)::BIGINT AS total_clicks,
      AVG(gqm.position) AS avg_position_val
    FROM gsc_query_metrics gqm
    WHERE gqm.user_id = p_user_id
      AND gqm.property_uri = p_property_uri
      AND gqm.normalized_url = p_normalized_url
      AND gqm.date >= p_comp_start_date
      AND gqm.date <= p_comp_end_date
    GROUP BY gqm.query_normalized
  )
  SELECT
    cp.q AS query,
    cp.qn AS query_normalized,
    cp.total_clicks AS clicks,
    cp.total_impressions AS impressions,
    ROUND(cp.avg_ctr_val, 6) AS avg_ctr,
    ROUND(cp.avg_position_val, 2) AS avg_position,
    CASE
      WHEN prev.avg_position_val IS NOT NULL THEN
        ROUND(cp.avg_position_val - prev.avg_position_val, 2)
      ELSE NULL
    END AS position_change,
    CASE
      WHEN prev.total_clicks IS NOT NULL THEN
        cp.total_clicks - prev.total_clicks
      ELSE NULL
    END AS clicks_change,
    -- 単語数: スペース（半角・全角）で分割した配列の長さ
    array_length(regexp_split_to_array(trim(cp.q), '[ \t\n\r　]+'), 1) AS word_count
  FROM current_period cp
  LEFT JOIN comparison_period prev ON cp.qn = prev.qn
  ORDER BY cp.total_clicks DESC;
END;
$$;

-- サマリー取得用の軽量RPC（クエリ詳細は不要な場合用）
CREATE OR REPLACE FUNCTION public.get_gsc_query_summary(
  p_user_id UUID,
  p_property_uri TEXT,
  p_normalized_url TEXT,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_queries BIGINT,
  total_clicks BIGINT,
  total_impressions BIGINT,
  avg_position NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COUNT(DISTINCT query_normalized)::BIGINT AS total_queries,
    SUM(clicks)::BIGINT AS total_clicks,
    SUM(impressions)::BIGINT AS total_impressions,
    ROUND(AVG(position), 2) AS avg_position
  FROM gsc_query_metrics
  WHERE user_id = p_user_id
    AND property_uri = p_property_uri
    AND normalized_url = p_normalized_url
    AND date >= p_start_date
    AND date <= p_end_date;
$$;

COMMENT ON FUNCTION public.get_gsc_query_analysis IS 'GSCクエリ分析: DB側で集計・期間比較を行う高速RPC。PropertyURIフィルタを追加しインデックス効率を最適化。日本語全角スペース対応。';
COMMENT ON FUNCTION public.get_gsc_query_summary IS 'GSCクエリサマリー: 軽量な集計のみ';
