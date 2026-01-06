-- オーナー権限の完全読み取り専用化（DBレイヤーの安全網）

-- 1. chat_sessions
DROP POLICY IF EXISTS "chat_sessions_insert_own" ON public.chat_sessions;
CREATE POLICY "chat_sessions_insert_own" ON public.chat_sessions
  FOR INSERT WITH CHECK (
    auth.uid()::text = user_id AND 
    (SELECT role FROM public.users WHERE id = auth.uid()) <> 'owner'
  );

DROP POLICY IF EXISTS "chat_sessions_update_own" ON public.chat_sessions;
CREATE POLICY "chat_sessions_update_own" ON public.chat_sessions
  FOR UPDATE USING (
    auth.uid()::text = user_id AND 
    (SELECT role FROM public.users WHERE id = auth.uid()) <> 'owner'
  );

DROP POLICY IF EXISTS "chat_sessions_delete_own" ON public.chat_sessions;
CREATE POLICY "chat_sessions_delete_own" ON public.chat_sessions
  FOR DELETE USING (
    auth.uid()::text = user_id AND 
    (SELECT role FROM public.users WHERE id = auth.uid()) <> 'owner'
  );

-- 2. chat_messages
DROP POLICY IF EXISTS "chat_messages_insert_own" ON public.chat_messages;
CREATE POLICY "chat_messages_insert_own" ON public.chat_messages
  FOR INSERT WITH CHECK (
    auth.uid()::text = user_id AND 
    (SELECT role FROM public.users WHERE id = auth.uid()) <> 'owner'
  );

-- 3. content_annotations
DROP POLICY IF EXISTS "content_annotations_mutation_own" ON public.content_annotations;
CREATE POLICY "content_annotations_mutation_own" ON public.content_annotations
  FOR ALL 
  USING (
    auth.uid()::text = user_id AND 
    (SELECT role FROM public.users WHERE id = auth.uid()) <> 'owner'
  )
  WITH CHECK (
    auth.uid()::text = user_id AND 
    (SELECT role FROM public.users WHERE id = auth.uid()) <> 'owner'
  );

-- 4. briefs
DROP POLICY IF EXISTS "briefs_mutation_own" ON public.briefs;
CREATE POLICY "briefs_mutation_own" ON public.briefs
  FOR ALL
  USING (
    auth.uid()::text = user_id AND 
    (SELECT role FROM public.users WHERE id = auth.uid()) <> 'owner'
  )
  WITH CHECK (
    auth.uid()::text = user_id AND 
    (SELECT role FROM public.users WHERE id = auth.uid()) <> 'owner'
  );

-- 5. wordpress_settings (user_id is UUID)
DROP POLICY IF EXISTS "wordpress_settings_mutation_own" ON public.wordpress_settings;
CREATE POLICY "wordpress_settings_mutation_own" ON public.wordpress_settings
  FOR ALL
  USING (
    auth.uid() = user_id AND
    (SELECT role FROM public.users WHERE id = auth.uid()) <> 'owner'
  )
  WITH CHECK (
    auth.uid() = user_id AND
    (SELECT role FROM public.users WHERE id = auth.uid()) <> 'owner'
  );

-- 6. gsc_credentials (user_id is UUID)
DROP POLICY IF EXISTS "gsc_credentials_mutation_own" ON public.gsc_credentials;
CREATE POLICY "gsc_credentials_mutation_own" ON public.gsc_credentials
  FOR ALL
  USING (
    auth.uid() = user_id AND
    (SELECT role FROM public.users WHERE id = auth.uid()) <> 'owner'
  )
  WITH CHECK (
    auth.uid() = user_id AND
    (SELECT role FROM public.users WHERE id = auth.uid()) <> 'owner'
  );

-- 7. gsc_article_evaluations (user_id is UUID)
DROP POLICY IF EXISTS "gsc_article_evaluations_mutation_own" ON public.gsc_article_evaluations;
CREATE POLICY "gsc_article_evaluations_mutation_own" ON public.gsc_article_evaluations
  FOR ALL
  USING (
    auth.uid() = user_id AND
    (SELECT role FROM public.users WHERE id = auth.uid()) <> 'owner'
  )
  WITH CHECK (
    auth.uid() = user_id AND
    (SELECT role FROM public.users WHERE id = auth.uid()) <> 'owner'
  );

-- Note: SELECT policies are already handled in 20260107000002_update_rls_policies.sql
-- They use separate policy names like "*_select_own_or_owner"

-- Rollback:
-- DROP POLICY IF EXISTS "chat_sessions_insert_own" ON public.chat_sessions;
-- DROP POLICY IF EXISTS "chat_sessions_update_own" ON public.chat_sessions;
-- DROP POLICY IF EXISTS "chat_sessions_delete_own" ON public.chat_sessions;
-- DROP POLICY IF EXISTS "chat_messages_insert_own" ON public.chat_messages;
-- DROP POLICY IF EXISTS "content_annotations_mutation_own" ON public.content_annotations;
-- DROP POLICY IF EXISTS "briefs_mutation_own" ON public.briefs;
-- DROP POLICY IF EXISTS "wordpress_settings_mutation_own" ON public.wordpress_settings;
-- DROP POLICY IF EXISTS "gsc_credentials_mutation_own" ON public.gsc_credentials;
-- DROP POLICY IF EXISTS "gsc_article_evaluations_mutation_own" ON public.gsc_article_evaluations;
