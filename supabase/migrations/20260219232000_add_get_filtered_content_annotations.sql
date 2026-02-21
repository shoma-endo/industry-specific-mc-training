-- Add get_filtered_content_annotations RPC to safely filter categories without PostgREST filter strings
-- Returns one row: paged items(jsonb array) + total_count

CREATE OR REPLACE FUNCTION public.get_filtered_content_annotations(
  p_user_id uuid,
  p_page integer,
  p_per_page integer,
  p_selected_category_names text[] DEFAULT '{}'::text[],
  p_include_uncategorized boolean DEFAULT false
)
RETURNS TABLE(items jsonb, total_count bigint)
LANGUAGE sql
STABLE
AS $$
  WITH normalized AS (
    SELECT
      GREATEST(1, COALESCE(p_page, 1)) AS page,
      GREATEST(1, LEAST(100, COALESCE(p_per_page, 100))) AS per_page,
      COALESCE(
        (
          SELECT ARRAY_AGG(trimmed_name)
          FROM (
            SELECT DISTINCT trim(name) AS trimmed_name
            FROM unnest(COALESCE(p_selected_category_names, '{}'::text[])) AS name
            WHERE trim(name) <> ''
          ) normalized_names
        ),
        '{}'::text[]
      ) AS selected_names,
      COALESCE(p_include_uncategorized, false) AS include_uncategorized
  ),
  filtered AS (
    SELECT ca.*
    FROM public.content_annotations ca
    CROSS JOIN normalized n
    CROSS JOIN LATERAL (
      SELECT COALESCE(
        ARRAY_AGG(trim(category_name)) FILTER (WHERE trim(category_name) <> ''),
        '{}'::text[]
      ) AS normalized_wp_category_names
      FROM unnest(COALESCE(ca.wp_category_names, '{}'::text[])) AS category_name
    ) norm
    WHERE ca.user_id = ANY(public.get_accessible_user_ids(p_user_id)::text[])
      AND (
        (COALESCE(array_length(n.selected_names, 1), 0) = 0 AND n.include_uncategorized = false)
        OR (
          COALESCE(array_length(n.selected_names, 1), 0) > 0
          AND norm.normalized_wp_category_names && n.selected_names
        )
        OR (
          n.include_uncategorized = true
          AND COALESCE(array_length(norm.normalized_wp_category_names, 1), 0) = 0
        )
      )
  ),
  ordered AS (
    SELECT
      f.*,
      ROW_NUMBER() OVER (ORDER BY f.updated_at DESC NULLS LAST) AS rn
    FROM filtered f
  ),
  paged AS (
    SELECT
      to_jsonb(o.*) AS annotation,
      o.rn
    FROM ordered o
    CROSS JOIN normalized n
    WHERE o.rn > (n.page - 1) * n.per_page
      AND o.rn <= n.page * n.per_page
  )
  SELECT
    COALESCE(
      (SELECT jsonb_agg(p.annotation ORDER BY p.rn) FROM paged p),
      '[]'::jsonb
    ) AS items,
    COALESCE((SELECT COUNT(*) FROM filtered), 0)::bigint AS total_count;
$$;

-- Performance indexes for filtered analytics query
-- NOTE: user_id single-column index is not added here because
-- idx_content_annotations_user_post(user_id, wp_post_id) already exists.
CREATE INDEX IF NOT EXISTS idx_content_annotations_wp_category_names
  ON public.content_annotations USING GIN (wp_category_names);

CREATE INDEX IF NOT EXISTS idx_content_annotations_user_updated_at
  ON public.content_annotations (user_id, updated_at DESC NULLS LAST);

-- Rollback:
-- DROP FUNCTION IF EXISTS public.get_filtered_content_annotations(uuid, integer, integer, text[], boolean);
-- DROP INDEX IF EXISTS idx_content_annotations_user_updated_at;
-- DROP INDEX IF EXISTS idx_content_annotations_wp_category_names;
