-- Add hybrid search for prompt_chunks
CREATE OR REPLACE FUNCTION search_prompt_chunks_hybrid(
  query_text TEXT,
  query_embedding VECTOR(1536),
  target_template_id UUID DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.7,
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
    WHERE (target_template_id IS NULL OR pc.template_id = target_template_id)
      AND pc.embedding <=> query_embedding < 1 - match_threshold
  ),
  bm25_raw AS (
    SELECT
      pc.id,
      pc.chunk_text,
      pc.chunk_index,
      pc.template_id,
      ts_rank_cd(
        to_tsvector('simple', pc.chunk_text),
        websearch_to_tsquery('simple', query_text)
      ) AS raw_bm25
    FROM prompt_chunks pc
    WHERE (target_template_id IS NULL OR pc.template_id = target_template_id)
      AND to_tsvector('simple', pc.chunk_text) @@ websearch_to_tsquery('simple', query_text)
  ),
  max_bm25 AS (
    SELECT GREATEST(MAX(raw_bm25), 1e-6) AS max_score FROM bm25_raw
  ),
  bm25_search AS (
    SELECT
      br.id,
      br.chunk_text,
      br.chunk_index,
      br.template_id,
      LEAST(1.0, br.raw_bm25 / mb.max_score) AS bm25_score
    FROM bm25_raw br, max_bm25 mb
  ),
  combined_search AS (
    SELECT DISTINCT ON (COALESCE(s.id, b.id))
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

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS prompt_chunks_content_fts_idx ON prompt_chunks USING gin(to_tsvector('simple', chunk_text));
CREATE INDEX IF NOT EXISTS prompt_chunks_template_idx ON prompt_chunks(template_id);