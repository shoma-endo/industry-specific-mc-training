-- Fix RLS policies for content_annotation_categories
DROP POLICY IF EXISTS "Users can view their annotation categories"
  ON public.content_annotation_categories;

DROP POLICY IF EXISTS "Users can insert annotation categories"
  ON public.content_annotation_categories;

DROP POLICY IF EXISTS "Users can delete annotation categories"
  ON public.content_annotation_categories;

CREATE POLICY "Users can view their annotation categories"
  ON public.content_annotation_categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.content_categories c
      WHERE c.id = category_id AND c.user_id = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM public.content_annotations a
      WHERE a.id = annotation_id AND a.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert annotation categories"
  ON public.content_annotation_categories FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.content_categories c
      WHERE c.id = category_id AND c.user_id = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM public.content_annotations a
      WHERE a.id = annotation_id AND a.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can delete annotation categories"
  ON public.content_annotation_categories FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.content_categories c
      WHERE c.id = category_id AND c.user_id = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM public.content_annotations a
      WHERE a.id = annotation_id AND a.user_id = auth.uid()::text
    )
  );

-- Rollback
-- DROP POLICY IF EXISTS "Users can delete annotation categories" ON public.content_annotation_categories;
-- DROP POLICY IF EXISTS "Users can insert annotation categories" ON public.content_annotation_categories;
-- DROP POLICY IF EXISTS "Users can view their annotation categories" ON public.content_annotation_categories;
