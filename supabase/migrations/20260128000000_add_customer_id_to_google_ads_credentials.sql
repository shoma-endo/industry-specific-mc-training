-- Add customer_id field to google_ads_credentials table
--
-- Rollback:
--   ALTER TABLE google_ads_credentials DROP COLUMN IF EXISTS customer_id;

ALTER TABLE google_ads_credentials
ADD COLUMN customer_id text; -- Selected Google Ads account ID (customer ID)

COMMENT ON COLUMN google_ads_credentials.customer_id IS '選択されたGoogle AdsアカウントID（customer ID）';
