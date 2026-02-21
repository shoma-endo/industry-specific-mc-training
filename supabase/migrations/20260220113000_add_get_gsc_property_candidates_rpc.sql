-- GSCプロパティ候補解決用RPC
-- gsc_query_metricsをDB側で集計し、property_uri候補を優先度順で返す
-- Rollback:
-- DROP FUNCTION IF EXISTS public.get_gsc_property_candidates(uuid, text, date, date);
-- DROP INDEX IF EXISTS idx_gsc_query_metrics_user_url_date_property;

CREATE OR REPLACE FUNCTION public.get_gsc_property_candidates(
  p_user_id UUID,
  p_normalized_url TEXT,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  property_uri TEXT,
  row_count BIGINT,
  total_impressions BIGINT,
  total_clicks BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    gqm.property_uri,
    COUNT(*)::BIGINT AS row_count,
    COALESCE(SUM(gqm.impressions), 0)::BIGINT AS total_impressions,
    COALESCE(SUM(gqm.clicks), 0)::BIGINT AS total_clicks
  FROM public.gsc_query_metrics gqm
  WHERE gqm.user_id = p_user_id
    AND gqm.normalized_url = p_normalized_url
    AND gqm.date >= p_start_date
    AND gqm.date <= p_end_date
  GROUP BY gqm.property_uri
  ORDER BY total_impressions DESC, total_clicks DESC, row_count DESC;
$$;

COMMENT ON FUNCTION public.get_gsc_property_candidates IS
  'GSCプロパティ候補解決: URL×期間でproperty_uriをDB集計し、表示回数/クリック/行数の順で返す';

-- p_property_uri なしのURL×期間集計向けインデックス
CREATE INDEX IF NOT EXISTS idx_gsc_query_metrics_user_url_date_property
  ON public.gsc_query_metrics (user_id, normalized_url, date DESC, property_uri);
