-- Add template-filtered hybrid search for prompt_chunks
CREATE OR REPLACE FUNCTION search_prompt_chunks_hybrid_by_template(
  target_template_id UUID,
  query_text TEXT,
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.78,
  match_count INT DEFAULT 50,
  alpha FLOAT DEFAULT 0.5
)
RETURNS TABLE(
  id UUID,
  chunk_text TEXT,
  chunk_index INTEGER,
  template_id UUID,
  similarity FLOAT,
  bm25_score FLOAT,
  combined_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH semantic_search AS (
    SELECT
      pc.id,
      pc.chunk_text,
      pc.chunk_index,
      pc.template_id,
      (pc.embedding <=> query_embedding) AS distance,
      1 - (pc.embedding <=> query_embedding) AS similarity
    FROM prompt_chunks pc
    WHERE pc.template_id = target_template_id
      AND pc.embedding <=> query_embedding < 1 - match_threshold
  ),
  bm25_search AS (
    SELECT
      pc.id,
      pc.chunk_text,
      pc.chunk_index,
      pc.template_id,
      -- BM25スコア正規化（0-1範囲に調整）
      LEAST(1.0, ts_rank_cd(
        to_tsvector('simple', pc.chunk_text),
        websearch_to_tsquery('simple', query_text)
      ) * 10.0) AS bm25_score
    FROM prompt_chunks pc
    WHERE pc.template_id = target_template_id
      AND to_tsvector('simple', pc.chunk_text) @@ websearch_to_tsquery('simple', query_text)
  ),
  combined_search AS (
    SELECT
      COALESCE(s.id, b.id) AS id,
      COALESCE(s.chunk_text, b.chunk_text) AS chunk_text,
      COALESCE(s.chunk_index, b.chunk_index) AS chunk_index,
      COALESCE(s.template_id, b.template_id) AS template_id,
      COALESCE(s.similarity, 0) AS similarity,
      COALESCE(b.bm25_score, 0) AS bm25_score,
      (alpha * COALESCE(s.similarity, 0) + (1 - alpha) * COALESCE(b.bm25_score, 0)) AS combined_score
    FROM semantic_search s
    FULL OUTER JOIN bm25_search b ON s.id = b.id
  )
  SELECT
    combined_search.id,
    combined_search.chunk_text,
    combined_search.chunk_index,
    combined_search.template_id,
    combined_search.similarity,
    combined_search.bm25_score,
    combined_search.combined_score
  FROM combined_search
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;