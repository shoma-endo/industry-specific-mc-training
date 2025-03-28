CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  line_user_id TEXT NOT NULL UNIQUE,
  line_display_name TEXT NOT NULL,
  line_picture_url TEXT,
  line_status_message TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at BIGINT
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "開発環境用全許可ポリシー_users" ON users
  FOR ALL USING (true);

CREATE POLICY "ユーザー所有データのみ許可_users" ON users
  FOR ALL USING (line_user_id = auth.uid()::TEXT);

CREATE INDEX IF NOT EXISTS users_line_user_id_idx ON users (line_user_id);
CREATE INDEX IF NOT EXISTS users_stripe_customer_id_idx ON users (stripe_customer_id);
CREATE INDEX IF NOT EXISTS users_stripe_subscription_id_idx ON users (stripe_subscription_id);
