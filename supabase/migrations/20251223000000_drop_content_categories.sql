-- Drop unused content category tables
DROP FUNCTION IF EXISTS public.update_category_sort_orders(uuid[], text);
DROP FUNCTION IF EXISTS public.set_annotation_categories(uuid, uuid[], text);
DROP FUNCTION IF EXISTS public.update_category_sort_orders(uuid[]);
DROP FUNCTION IF EXISTS public.set_annotation_categories(uuid, uuid[]);

DROP TABLE IF EXISTS public.content_annotation_categories;
DROP TABLE IF EXISTS public.content_categories;

-- Rollback:
-- Recreate tables and related policies/functions by reapplying:
-- 20251219000000_create_content_categories.sql
-- 20251220000000_fix_content_annotation_categories_rls.sql
-- 20251220013000_add_category_rpc_functions.sql
-- 20251220014000_optimize_category_rls_and_indexes.sql
-- 20251220020000_fix_category_rpc_user_id.sql
