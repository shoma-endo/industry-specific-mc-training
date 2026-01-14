-- Update RLS policies to support owner/staff access
-- get_accessible_user_ids returns text[] for compatibility

-- 1. chat_sessions (user_id is TEXT)
DROP POLICY IF EXISTS "chat_sessions_select_own" ON public.chat_sessions;
DROP POLICY IF EXISTS "chat_sessions_select_own_or_owner" ON public.chat_sessions;
CREATE POLICY "chat_sessions_select_own_or_owner" ON public.chat_sessions
  FOR SELECT
  USING (user_id = ANY(public.get_accessible_user_ids(auth.uid())));

-- 2. chat_messages (user_id is TEXT)
DROP POLICY IF EXISTS "chat_messages_select_own" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_select_own_or_owner" ON public.chat_messages;
CREATE POLICY "chat_messages_select_own_or_owner" ON public.chat_messages
  FOR SELECT
  USING (user_id = ANY(public.get_accessible_user_ids(auth.uid())));

-- 3. content_annotations (user_id is TEXT)
DROP POLICY IF EXISTS "content_annotations_select_own" ON public.content_annotations;
DROP POLICY IF EXISTS "content_annotations_select_own_or_owner" ON public.content_annotations;
CREATE POLICY "content_annotations_select_own_or_owner" ON public.content_annotations
  FOR SELECT
  USING (user_id = ANY(public.get_accessible_user_ids(auth.uid())));

-- 4. wordpress_settings (user_id is UUID, cast text[] to uuid[])
DROP POLICY IF EXISTS "wordpress_settings_select_own" ON public.wordpress_settings;
DROP POLICY IF EXISTS "wordpress_settings_select_own_or_owner" ON public.wordpress_settings;
CREATE POLICY "wordpress_settings_select_own_or_owner" ON public.wordpress_settings
  FOR SELECT
  USING (user_id = ANY(public.get_accessible_user_ids(auth.uid())::uuid[]));

-- 5. gsc_credentials (user_id is UUID, cast text[] to uuid[])
DROP POLICY IF EXISTS "gsc_credentials_select_own" ON public.gsc_credentials;
DROP POLICY IF EXISTS "gsc_credentials_select_own_or_owner" ON public.gsc_credentials;
CREATE POLICY "gsc_credentials_select_own_or_owner" ON public.gsc_credentials
  FOR SELECT
  USING (user_id = ANY(public.get_accessible_user_ids(auth.uid())::uuid[]));

-- 6. gsc_page_metrics (user_id is UUID, cast text[] to uuid[])
DROP POLICY IF EXISTS "gsc_page_metrics_select_own" ON public.gsc_page_metrics;
DROP POLICY IF EXISTS "gsc_page_metrics_select_own_or_owner" ON public.gsc_page_metrics;
CREATE POLICY "gsc_page_metrics_select_own_or_owner" ON public.gsc_page_metrics
  FOR SELECT
  USING (user_id = ANY(public.get_accessible_user_ids(auth.uid())::uuid[]));

-- 7. gsc_article_evaluations (user_id is UUID, cast text[] to uuid[])
DROP POLICY IF EXISTS "gsc_article_evaluations_select_own" ON public.gsc_article_evaluations;
DROP POLICY IF EXISTS "gsc_article_evaluations_select_own_or_owner" ON public.gsc_article_evaluations;
CREATE POLICY "gsc_article_evaluations_select_own_or_owner" ON public.gsc_article_evaluations
  FOR SELECT
  USING (user_id = ANY(public.get_accessible_user_ids(auth.uid())::uuid[]));

-- 8. gsc_article_evaluation_history (user_id is UUID, cast text[] to uuid[])
DROP POLICY IF EXISTS "gsc_article_ev_hist_select_own" ON public.gsc_article_evaluation_history;
DROP POLICY IF EXISTS "gsc_article_evaluation_history_select_own_or_owner" ON public.gsc_article_evaluation_history;
CREATE POLICY "gsc_article_evaluation_history_select_own_or_owner" ON public.gsc_article_evaluation_history
  FOR SELECT
  USING (user_id = ANY(public.get_accessible_user_ids(auth.uid())::uuid[]));

-- 9. gsc_query_metrics (user_id is UUID, cast text[] to uuid[])
DROP POLICY IF EXISTS "gsc_query_metrics_select_own" ON public.gsc_query_metrics;
DROP POLICY IF EXISTS "gsc_query_metrics_select_own_or_owner" ON public.gsc_query_metrics;
CREATE POLICY "gsc_query_metrics_select_own_or_owner" ON public.gsc_query_metrics
  FOR SELECT
  USING (user_id = ANY(public.get_accessible_user_ids(auth.uid())::uuid[]));

-- Rollback:
-- DROP POLICY IF EXISTS "chat_sessions_select_own_or_owner" ON public.chat_sessions;
-- CREATE POLICY "chat_sessions_select_own" ON public.chat_sessions FOR SELECT USING (auth.uid()::text = user_id);
--
-- DROP POLICY IF EXISTS "chat_messages_select_own_or_owner" ON public.chat_messages;
-- CREATE POLICY "chat_messages_select_own" ON public.chat_messages FOR SELECT USING (auth.uid()::text = user_id);
--
-- DROP POLICY IF EXISTS "content_annotations_select_own_or_owner" ON public.content_annotations;
-- CREATE POLICY "content_annotations_select_own" ON public.content_annotations FOR SELECT USING (auth.uid()::text = user_id);
--
-- DROP POLICY IF EXISTS "wordpress_settings_select_own_or_owner" ON public.wordpress_settings;
-- CREATE POLICY "wordpress_settings_select_own" ON public.wordpress_settings FOR SELECT USING (auth.uid()::text = user_id);
--
-- DROP POLICY IF EXISTS "gsc_credentials_select_own_or_owner" ON public.gsc_credentials;
-- CREATE POLICY "gsc_credentials_select_own" ON public.gsc_credentials FOR SELECT USING (auth.uid()::text = user_id);
--
-- DROP POLICY IF EXISTS "gsc_page_metrics_select_own_or_owner" ON public.gsc_page_metrics;
-- CREATE POLICY "gsc_page_metrics_select_own" ON public.gsc_page_metrics FOR SELECT USING (auth.uid()::text = user_id);
--
-- DROP POLICY IF EXISTS "gsc_article_evaluations_select_own_or_owner" ON public.gsc_article_evaluations;
-- CREATE POLICY "gsc_article_evaluations_select_own" ON public.gsc_article_evaluations FOR SELECT USING (auth.uid()::text = user_id);
--
-- DROP POLICY IF EXISTS "gsc_article_evaluation_history_select_own_or_owner" ON public.gsc_article_evaluation_history;
-- CREATE POLICY "gsc_article_ev_hist_select_own" ON public.gsc_article_evaluation_history FOR SELECT USING (auth.uid()::text = user_id);
--
-- DROP POLICY IF EXISTS "gsc_query_metrics_select_own_or_owner" ON public.gsc_query_metrics;
-- CREATE POLICY "gsc_query_metrics_select_own" ON public.gsc_query_metrics FOR SELECT USING (auth.uid()::text = user_id);
