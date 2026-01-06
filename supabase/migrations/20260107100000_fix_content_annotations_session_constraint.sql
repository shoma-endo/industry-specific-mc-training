-- Fix content_annotations session_id constraint for ON CONFLICT support
-- Problem: Partial unique index cannot be used with ON CONFLICT clause in PostgreSQL
-- Solution: Replace partial unique index with a proper UNIQUE constraint

-- Step 1: Drop the partial unique index
DROP INDEX IF EXISTS idx_content_annotations_session_unique;

-- Step 2: Add a proper UNIQUE constraint on session_id
-- Note: session_id can be NULL (for annotations not linked to a session),
-- but PostgreSQL UNIQUE constraints allow multiple NULLs by default
ALTER TABLE public.content_annotations
  ADD CONSTRAINT content_annotations_session_id_unique UNIQUE (session_id);

-- Rollback:
-- ALTER TABLE public.content_annotations DROP CONSTRAINT IF EXISTS content_annotations_session_id_unique;
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_content_annotations_session_unique
--   ON public.content_annotations(session_id) WHERE session_id IS NOT NULL;

