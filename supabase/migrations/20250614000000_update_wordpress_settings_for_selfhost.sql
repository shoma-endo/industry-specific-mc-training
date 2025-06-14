-- WordPress設定テーブルをセルフホスト対応に更新

-- wp_typeカラム追加（WordPress.comかセルフホストかを識別）
alter table public.wordpress_settings 
add column wp_type text not null default 'wordpress_com' 
check (wp_type in ('wordpress_com', 'self_hosted'));

-- wp_site_urlカラム追加（セルフホストWordPressのサイトURL用）
alter table public.wordpress_settings 
add column wp_site_url text;

-- wp_usernameカラム追加（セルフホストWordPress用）
alter table public.wordpress_settings 
add column wp_username text;

-- wp_application_passwordカラム追加（セルフホストWordPress用）
alter table public.wordpress_settings 
add column wp_application_password text;

-- 既存のフィールドをNULL許可に変更（セルフホストでは使用しないため）
alter table public.wordpress_settings 
alter column wp_client_id drop not null;

alter table public.wordpress_settings 
alter column wp_client_secret drop not null;

alter table public.wordpress_settings 
alter column wp_site_id drop not null;

-- CHECKコンストラクトを追加して、適切なフィールドが設定されることを保証
alter table public.wordpress_settings 
add constraint wordpress_settings_fields_check 
check (
  (wp_type = 'wordpress_com' and wp_client_id is not null and wp_client_secret is not null and wp_site_id is not null)
  or 
  (wp_type = 'self_hosted' and wp_site_url is not null and wp_username is not null and wp_application_password is not null)
);

-- コメント追加
comment on column public.wordpress_settings.wp_type is 'WordPress種別: wordpress_com または self_hosted';
comment on column public.wordpress_settings.wp_site_url is 'セルフホストWordPressのサイトURL（例: https://example.com）';
comment on column public.wordpress_settings.wp_username is 'セルフホストWordPressのユーザー名';
comment on column public.wordpress_settings.wp_application_password is 'セルフホストWordPressのアプリケーションパスワード';