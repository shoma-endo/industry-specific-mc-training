-- 既存のポリシーを削除
DROP POLICY IF EXISTS "ユーザーは自分のtodosのみ参照可能" ON todos;
DROP POLICY IF EXISTS "ユーザーは自分のtodosのみ挿入可能" ON todos;
DROP POLICY IF EXISTS "ユーザーは自分のtodosのみ更新可能" ON todos;
DROP POLICY IF EXISTS "ユーザーは自分のtodosのみ削除可能" ON todos;

-- テスト用の簡易アクセスポリシーを作成
CREATE POLICY "開発環境用全許可ポリシー" ON todos
  FOR ALL USING (true);

-- 既存テーブルが存在しない場合は作成（初回実行時用）
CREATE TABLE IF NOT EXISTS todos (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  user_id TEXT,
  created_at BIGINT NOT NULL
);

-- インデックス追加（まだ存在しない場合）
CREATE INDEX IF NOT EXISTS todos_user_id_idx ON todos (user_id);
CREATE INDEX IF NOT EXISTS todos_created_at_idx ON todos (created_at);
