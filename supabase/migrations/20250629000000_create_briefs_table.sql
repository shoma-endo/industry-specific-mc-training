-- 事業者情報テーブル
CREATE TABLE IF NOT EXISTS briefs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL UNIQUE,
  data        JSONB NOT NULL,
  created_at  BIGINT NOT NULL,
  updated_at  BIGINT NOT NULL
);

-- RLS を有効化
ALTER TABLE briefs ENABLE ROW LEVEL SECURITY;

-- 開発環境用全許可ポリシー（運用時に見直し要）
CREATE POLICY "開発環境用全許可ポリシー_briefs" ON briefs
  FOR ALL USING (true);

-- インデックス
CREATE INDEX IF NOT EXISTS briefs_user_id_idx ON briefs(user_id);
CREATE INDEX IF NOT EXISTS briefs_created_at_idx ON briefs(created_at);

-- コメント
COMMENT ON TABLE briefs IS '事業者情報を保存するテーブル';
COMMENT ON COLUMN briefs.data IS '事業者情報フォームの全フィールドを JSONB で保存';