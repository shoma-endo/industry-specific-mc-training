-- Make position columns nullable in gsc_article_evaluation_history
-- Purpose: Allow error records to be saved even when position data is unavailable

-- Make current_position nullable (errors won't have position data)
ALTER TABLE public.gsc_article_evaluation_history
ALTER COLUMN current_position DROP NOT NULL;

-- Make previous_position nullable (errors won't have position data)
ALTER TABLE public.gsc_article_evaluation_history
ALTER COLUMN previous_position DROP NOT NULL;

COMMENT ON COLUMN public.gsc_article_evaluation_history.current_position IS 'Current search position (nullable for error records)';
COMMENT ON COLUMN public.gsc_article_evaluation_history.previous_position IS 'Previous search position (nullable for error records)';

-- Rollback instructions (execute these commands to undo this migration):
-- ALTER TABLE public.gsc_article_evaluation_history ALTER COLUMN previous_position SET NOT NULL;
-- ALTER TABLE public.gsc_article_evaluation_history ALTER COLUMN current_position SET NOT NULL;
