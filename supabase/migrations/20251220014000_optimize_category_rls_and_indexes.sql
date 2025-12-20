-- Optimize RLS policies and indexes for category operations
-- Fixes:
-- 1. Add missing indexes for EXISTS subqueries in RLS policies
-- 2. Fix OR logic in content_annotation_categories RLS policies (change to AND)
-- 3. Fix content_categories RLS policies (change USING (true) to proper user_id check)

-- 1. Add indexes for RLS policy EXISTS subqueries
-- Index for content_annotations(id, user_id) used in RLS policies and RPC functions
CREATE INDEX IF NOT EXISTS idx_content_annotations_id_user_id 
  ON public.content_annotations(id, user_id);

-- Index for content_categories(id, user_id) used in RLS policies
CREATE INDEX IF NOT EXISTS idx_content_categories_id_user_id 
  ON public.content_categories(id, user_id);

-- 2. Fix content_categories RLS policies (currently USING (true) allows all users)
DROP POLICY IF EXISTS "Users can view their own categories"
  ON public.content_categories;

DROP POLICY IF EXISTS "Users can insert their own categories"
  ON public.content_categories;

DROP POLICY IF EXISTS "Users can update their own categories"
  ON public.content_categories;

DROP POLICY IF EXISTS "Users can delete their own categories"
  ON public.content_categories;

CREATE POLICY "Users can view their own categories"
  ON public.content_categories FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own categories"
  ON public.content_categories FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own categories"
  ON public.content_categories FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can delete their own categories"
  ON public.content_categories FOR DELETE
  USING (user_id = auth.uid()::text);

-- 3. Fix content_annotation_categories RLS policies (change OR to AND)
-- Current OR logic allows cross-user access, which is a security issue
DROP POLICY IF EXISTS "Users can view their annotation categories"
  ON public.content_annotation_categories;

DROP POLICY IF EXISTS "Users can insert annotation categories"
  ON public.content_annotation_categories;

DROP POLICY IF EXISTS "Users can delete annotation categories"
  ON public.content_annotation_categories;

-- Require BOTH annotation AND category to be owned by the user
CREATE POLICY "Users can view their annotation categories"
  ON public.content_annotation_categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.content_categories c
      WHERE c.id = category_id AND c.user_id = auth.uid()::text
    )
    AND EXISTS (
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
    AND EXISTS (
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
    AND EXISTS (
      SELECT 1 FROM public.content_annotations a
      WHERE a.id = annotation_id AND a.user_id = auth.uid()::text
    )
  );

-- Rollback
-- DROP INDEX IF EXISTS idx_content_categories_id_user_id;
-- DROP INDEX IF EXISTS idx_content_annotations_id_user_id;
-- DROP POLICY IF EXISTS "Users can delete annotation categories" ON public.content_annotation_categories;
-- DROP POLICY IF EXISTS "Users can insert annotation categories" ON public.content_annotation_categories;
-- DROP POLICY IF EXISTS "Users can view their annotation categories" ON public.content_annotation_categories;
-- DROP POLICY IF EXISTS "Users can delete their own categories" ON public.content_categories;
-- DROP POLICY IF EXISTS "Users can update their own categories" ON public.content_categories;
-- DROP POLICY IF EXISTS "Users can insert their own categories" ON public.content_categories;
-- DROP POLICY IF EXISTS "Users can view their own categories" ON public.content_categories;
-- Then restore previous policies from 20251220000000_fix_content_annotation_categories_rls.sql and 20251219000000_create_content_categories.sql

