-- Add google_search_count column to users table
ALTER TABLE users ADD COLUMN google_search_count INTEGER DEFAULT 0;

-- Create function to increment google_search_count
CREATE OR REPLACE FUNCTION increment_google_search_count(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE users 
  SET google_search_count = google_search_count + 1,
      updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule monthly reset of google_search_count on the 1st of each month at 00:00 UTC
SELECT cron.schedule(
    'reset-google-search-count',
    '0 0 1 * *',
    'UPDATE users SET google_search_count = 0;'
);