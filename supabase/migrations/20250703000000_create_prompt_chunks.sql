-- ベクター拡張機能を有効化
CREATE EXTENSION IF NOT EXISTS vector;

-- RAG化対応: プロンプトチャンク格納テーブル
CREATE TABLE prompt_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES prompt_templates(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text  TEXT NOT NULL,
  embedding   VECTOR(1536) NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- インデックス作成
CREATE INDEX idx_prompt_chunks_template ON prompt_chunks(template_id, chunk_index);
CREATE INDEX idx_prompt_chunks_embedding ON prompt_chunks USING ivfflat (embedding vector_cosine_ops);

-- RLS（Row Level Security）設定
ALTER TABLE prompt_chunks ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーがあれば削除
DROP POLICY IF EXISTS "prompt_chunks_admin_policy" ON prompt_chunks;

-- 管理者権限（role='admin'）を持つユーザーのみアクセス可能（JWT クレーム参照）
CREATE POLICY "prompt_chunks_admin_policy" ON prompt_chunks
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- サービスロールは常にアクセス可能（RLSバイパス）
-- Service Role Key使用時は自動的にRLSが無効化される