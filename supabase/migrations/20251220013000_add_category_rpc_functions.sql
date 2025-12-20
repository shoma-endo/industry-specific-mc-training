-- Add RPC functions for category operations
CREATE OR REPLACE FUNCTION public.set_annotation_categories(
  p_annotation_id uuid,
  p_category_ids uuid[]
) RETURNS void AS $$
DECLARE
  v_user_id text;
  v_count int;
BEGIN
  v_user_id := auth.uid()::text;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.content_annotations a
    WHERE a.id = p_annotation_id AND a.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Annotation not found';
  END IF;

  DELETE FROM public.content_annotation_categories
  WHERE annotation_id = p_annotation_id;

  IF p_category_ids IS NULL OR array_length(p_category_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*)
    INTO v_count
    FROM public.content_categories c
    WHERE c.id = ANY(p_category_ids)
      AND c.user_id = v_user_id;

  IF v_count <> array_length(p_category_ids, 1) THEN
    RAISE EXCEPTION 'Invalid category ids';
  END IF;

  INSERT INTO public.content_annotation_categories (annotation_id, category_id)
  SELECT p_annotation_id, unnest(p_category_ids);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_category_sort_orders(
  p_category_ids uuid[]
) RETURNS void AS $$
DECLARE
  v_user_id text;
  v_updated int;
BEGIN
  v_user_id := auth.uid()::text;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_category_ids IS NULL OR array_length(p_category_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.content_categories c
  SET sort_order = v.new_order,
      updated_at = now()
  FROM (
    SELECT id, ordinality - 1 AS new_order
    FROM unnest(p_category_ids) WITH ORDINALITY AS u(id, ordinality)
  ) v
  WHERE c.id = v.id AND c.user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated <> array_length(p_category_ids, 1) THEN
    RAISE EXCEPTION 'Some categories not updated';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Rollback
-- DROP FUNCTION IF EXISTS public.update_category_sort_orders(uuid[]);
-- DROP FUNCTION IF EXISTS public.set_annotation_categories(uuid, uuid[]);
