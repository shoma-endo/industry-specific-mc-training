-- Update google_ads_credentials RLS policies and add updated_at trigger
-- Rollback:
--   DROP TRIGGER IF EXISTS update_google_ads_credentials_updated_at ON google_ads_credentials;
--   DROP POLICY IF EXISTS "google_ads_credentials_delete_own" ON google_ads_credentials;
--   DROP POLICY IF EXISTS "google_ads_credentials_update_own" ON google_ads_credentials;
--   DROP POLICY IF EXISTS "google_ads_credentials_insert_own" ON google_ads_credentials;
--   DROP POLICY IF EXISTS "google_ads_credentials_select_own" ON google_ads_credentials;
--
--   -- Restore original policies (auth.uid())
--   CREATE POLICY "google_ads_credentials_select_own"
--       ON google_ads_credentials FOR SELECT
--       USING (user_id = auth.uid());
--
--   CREATE POLICY "google_ads_credentials_insert_own"
--       ON google_ads_credentials FOR INSERT
--       WITH CHECK (user_id = auth.uid());
--
--   CREATE POLICY "google_ads_credentials_update_own"
--       ON google_ads_credentials FOR UPDATE
--       USING (user_id = auth.uid());
--
--   CREATE POLICY "google_ads_credentials_delete_own"
--       ON google_ads_credentials FOR DELETE
--       USING (user_id = auth.uid());

-- Update RLS policies to use accessible user ids
DROP POLICY IF EXISTS "google_ads_credentials_select_own" ON google_ads_credentials;
DROP POLICY IF EXISTS "google_ads_credentials_insert_own" ON google_ads_credentials;
DROP POLICY IF EXISTS "google_ads_credentials_update_own" ON google_ads_credentials;
DROP POLICY IF EXISTS "google_ads_credentials_delete_own" ON google_ads_credentials;

CREATE POLICY "google_ads_credentials_select_own"
    ON google_ads_credentials FOR SELECT
    USING (user_id::text = ANY(get_accessible_user_ids(auth.uid())));

CREATE POLICY "google_ads_credentials_insert_own"
    ON google_ads_credentials FOR INSERT
    WITH CHECK (user_id::text = ANY(get_accessible_user_ids(auth.uid())));

CREATE POLICY "google_ads_credentials_update_own"
    ON google_ads_credentials FOR UPDATE
    USING (user_id::text = ANY(get_accessible_user_ids(auth.uid())));

CREATE POLICY "google_ads_credentials_delete_own"
    ON google_ads_credentials FOR DELETE
    USING (user_id::text = ANY(get_accessible_user_ids(auth.uid())));

-- Ensure updated_at auto-update trigger exists
-- (Define function here in case it doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_google_ads_credentials_updated_at ON google_ads_credentials;
CREATE TRIGGER update_google_ads_credentials_updated_at
    BEFORE UPDATE ON google_ads_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
