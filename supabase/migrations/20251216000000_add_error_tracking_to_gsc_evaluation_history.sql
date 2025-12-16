-- Add error tracking to gsc_article_evaluation_history
-- Purpose: Record evaluation failures (GSC import errors, no metrics) for user visibility and troubleshooting

-- Add outcome_type column to distinguish between success and error
ALTER TABLE public.gsc_article_evaluation_history
ADD COLUMN outcome_type TEXT NOT NULL DEFAULT 'success' CHECK (outcome_type IN ('success', 'error'));

-- Add error tracking columns (nullable, only populated for errors)
ALTER TABLE public.gsc_article_evaluation_history
ADD COLUMN error_code TEXT,
ADD COLUMN error_message TEXT;

-- Make outcome nullable (errors won't have improved/no_change/worse)
ALTER TABLE public.gsc_article_evaluation_history
ALTER COLUMN outcome DROP NOT NULL;

-- Add index for efficient error filtering
CREATE INDEX IF NOT EXISTS idx_gsc_eval_history_outcome_type
  ON public.gsc_article_evaluation_history(outcome_type);

COMMENT ON COLUMN public.gsc_article_evaluation_history.outcome_type IS 'Type of evaluation result: success (normal evaluation) or error (failed to evaluate)';
COMMENT ON COLUMN public.gsc_article_evaluation_history.error_code IS 'Error code when outcome_type=error: import_failed, no_metrics, etc.';
COMMENT ON COLUMN public.gsc_article_evaluation_history.error_message IS 'Human-readable error message for troubleshooting';

-- Rollback instructions (execute these commands to undo this migration):
-- DROP INDEX IF EXISTS idx_gsc_eval_history_outcome_type;
-- ALTER TABLE public.gsc_article_evaluation_history DROP COLUMN IF EXISTS error_message;
-- ALTER TABLE public.gsc_article_evaluation_history DROP COLUMN IF EXISTS error_code;
-- ALTER TABLE public.gsc_article_evaluation_history DROP COLUMN IF EXISTS outcome_type;
-- ALTER TABLE public.gsc_article_evaluation_history ALTER COLUMN outcome SET NOT NULL;
