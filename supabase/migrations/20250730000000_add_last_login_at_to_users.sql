-- usersテーブルにlast_login_atカラムを追加
ALTER TABLE users 
ADD COLUMN last_login_at BIGINT;

-- インデックスを追加（ログイン時間での検索を効率化）
CREATE INDEX IF NOT EXISTS users_last_login_at_idx ON users (last_login_at);