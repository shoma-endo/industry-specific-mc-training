create table public.wordpress_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  wp_client_id text not null,
  wp_client_secret text not null, -- 暗号化を検討すべきセンシティブな情報
  wp_site_id text not null,        -- WordPress.comのサイトIDまたはサイトURL
  wp_access_token text,            -- OAuthで取得したアクセストークン (有効期限管理が必要)
  wp_refresh_token text,           -- リフレッシュトークン (もしあれば)
  wp_token_expires_at timestamp with time zone, -- トークンの有効期限
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now()),

  constraint wordpress_settings_user_id_key unique (user_id), -- 1ユーザー1WordPress設定を基本とする場合

  constraint wordpress_settings_user_id_fkey foreign key (user_id)
    references public.users(id) on delete cascade
);

-- Row Level Securityの有効化
alter table public.wordpress_settings enable row level security;

-- ユーザー自身のみデータ参照可能 (wp_client_secret の扱いに注意。通常は読み取り不可にすべき)
create policy "ユーザー自身のみ参照可能（注意喚起）"
  on public.wordpress_settings
  for select
  using ((select auth.uid()) = user_id);

-- ユーザー自身のみデータ登録/更新可能
create policy "ユーザー自身のみ登録・更新可能"
  on public.wordpress_settings
  for all -- insert, update, delete をまとめても良いし、個別でも良い
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 注意: wp_client_secret は非常にセンシティブな情報です。
-- RLSポリシーで select を許可する場合でも、アプリケーションロジックでクライアントに直接渡さないようにする、
-- または、そもそもRLSでは select を許可せず、サーバーサイドの信頼できる環境 (Edge Functionsなど) を経由してのみ
-- このシークレットを使用するように設計することを強く推奨します。
-- 理想的には、シークレットはデータベースに保存する際に暗号化することが望ましいです。