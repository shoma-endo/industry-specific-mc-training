-- Add get_available_category_names RPC function for efficient category list aggregation
-- Returns distinct category names from all accessible content_annotations

CREATE OR REPLACE FUNCTION public.get_available_category_names(p_user_id uuid)
RETURNS TABLE(name text)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT normalized.name
  FROM (
    SELECT trim(unnest(wp_category_names)::text) AS name
    FROM public.content_annotations
    WHERE user_id = ANY(public.get_accessible_user_ids(p_user_id)::text[])
      AND wp_category_names IS NOT NULL
      AND array_length(wp_category_names, 1) > 0
  ) AS normalized
  WHERE normalized.name != ''
  ORDER BY normalized.name;
$$;

-- Rollback:
-- DROP FUNCTION IF EXISTS public.get_available_category_names(uuid);
