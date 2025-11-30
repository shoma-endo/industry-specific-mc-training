-- WordPress.com 用アクセストークンを保存できるよう wordpress_settings にカラムを追加

alter table wordpress_settings
  add column if not exists wp_access_token text,
  add column if not exists wp_refresh_token text,
  add column if not exists wp_token_expires_at timestamptz;

comment on column wordpress_settings.wp_access_token is 'WordPress.com OAuth アクセストークン';
comment on column wordpress_settings.wp_refresh_token is 'WordPress.com OAuth リフレッシュトークン';
comment on column wordpress_settings.wp_token_expires_at is 'WordPress.com アクセストークン有効期限';

-- ロールバック
-- alter table wordpress_settings
--   drop column if exists wp_access_token,
--   drop column if exists wp_refresh_token,
--   drop column if exists wp_token_expires_at;
