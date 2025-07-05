-- ベクトル検索用のRPC関数を作成
CREATE OR REPLACE FUNCTION search_prompt_chunks(
  template_id UUID,
  query_embedding VECTOR(1536),
  similarity_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 4
)
RETURNS TABLE (
  id UUID,
  template_id UUID,
  chunk_index INTEGER,
  chunk_text TEXT,
  embedding VECTOR(1536),
  updated_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
AS $$
SELECT
  pc.id,
  pc.template_id,
  pc.chunk_index,
  pc.chunk_text,
  pc.embedding,
  pc.updated_at,
  1 - (pc.embedding <=> query_embedding) AS similarity
FROM prompt_chunks pc
WHERE pc.template_id = search_prompt_chunks.template_id
  AND 1 - (pc.embedding <=> query_embedding) > similarity_threshold
ORDER BY pc.embedding <=> query_embedding
LIMIT match_count;
$$;