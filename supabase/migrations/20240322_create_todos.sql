-- todos テーブルの作成
CREATE TABLE IF NOT EXISTS todos (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  user_id TEXT, -- LINEのユーザーID
  created_at BIGINT NOT NULL
);

-- RLSポリシーの設定
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーが自分のデータにアクセスできるポリシー
CREATE POLICY "認証済みユーザーのtodos読み取り" ON todos
  FOR SELECT TO authenticated USING (user_id = auth.uid()::TEXT);

-- 匿名アクセス用の許可ポリシー（開発環境用）
CREATE POLICY "匿名アクセス許可" ON todos
  FOR ALL USING (true);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS todos_user_id_idx ON todos (user_id);
CREATE INDEX IF NOT EXISTS todos_created_at_idx ON todos (created_at); 