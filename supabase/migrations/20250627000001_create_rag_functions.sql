-- キーワードテーブルに is_active 列が無い場合は追加
ALTER TABLE rag_individual_keywords
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- ベクトル類似度検索関数
CREATE OR REPLACE FUNCTION search_similar_keywords(
    query_embedding VECTOR(1536),
    similarity_threshold FLOAT DEFAULT 0.75,
    result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    keyword TEXT,
    classification VARCHAR(20),
    similarity FLOAT,
    service_type VARCHAR(50),
    region VARCHAR(50)
)
LANGUAGE SQL STABLE
AS $$
    SELECT 
        k.keyword,
        k.classification,
        1 - (k.keyword_embedding <=> query_embedding) AS similarity,
        k.service_type,
        k.region
    FROM rag_individual_keywords k
    WHERE 
        k.is_active = TRUE 
        AND k.keyword_embedding IS NOT NULL
        AND 1 - (k.keyword_embedding <=> query_embedding) > similarity_threshold
    ORDER BY similarity DESC
    LIMIT result_limit;
$$;

-- ハイブリッド検索関数
CREATE OR REPLACE FUNCTION hybrid_keyword_search(
    search_text TEXT,
    query_embedding VECTOR(1536),
    result_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    keyword TEXT,
    classification VARCHAR(20),
    similarity FLOAT,
    text_rank FLOAT,
    combined_score FLOAT
)
LANGUAGE SQL STABLE
AS $$
    WITH vector_results AS (
        SELECT 
            keyword,
            classification,
            1 - (keyword_embedding <=> query_embedding) AS similarity,
            0.0 as text_rank
        FROM rag_individual_keywords
        WHERE is_active = TRUE AND keyword_embedding IS NOT NULL
        ORDER BY similarity DESC
        LIMIT result_limit * 2
    ),
    text_results AS (
        SELECT 
            keyword,
            classification,
            0.0 as similarity,
            ts_rank(to_tsvector('simple', keyword), plainto_tsquery('simple', search_text)) AS text_rank
        FROM rag_individual_keywords
        WHERE 
            is_active = TRUE 
            AND to_tsvector('simple', keyword) @@ plainto_tsquery('simple', search_text)
        ORDER BY text_rank DESC
        LIMIT result_limit * 2
    ),
    combined AS (
        SELECT 
            keyword,
            classification,
            MAX(similarity) as similarity,
            MAX(text_rank) as text_rank,
            (MAX(similarity) * 0.7 + MAX(text_rank) * 0.3) as combined_score
        FROM (
            SELECT * FROM vector_results
            UNION ALL
            SELECT * FROM text_results
        ) results
        GROUP BY keyword, classification
    )
    SELECT * FROM combined
    ORDER BY combined_score DESC
    LIMIT result_limit;
$$;

-- 訓練データ検索関数
CREATE OR REPLACE FUNCTION search_training_data(
    query_embedding VECTOR(1536),
    similarity_threshold FLOAT DEFAULT 0.75,
    result_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    input_keywords TEXT[],
    output_classification JSONB,
    similarity FLOAT,
    immediate_count INTEGER,
    later_count INTEGER
)
LANGUAGE SQL STABLE
AS $$
    SELECT 
        t.id,
        t.input_keywords,
        t.output_classification,
        1 - (t.embedding <=> query_embedding) AS similarity,
        t.immediate_count,
        t.later_count
    FROM rag_training_data t
    WHERE 
        t.is_active = TRUE 
        AND t.embedding IS NOT NULL
        AND 1 - (t.embedding <=> query_embedding) > similarity_threshold
    ORDER BY similarity DESC
    LIMIT result_limit;
$$;

-- キーワード統計取得関数
CREATE OR REPLACE FUNCTION get_keyword_statistics()
RETURNS JSONB
LANGUAGE SQL STABLE
AS $$
    SELECT jsonb_build_object(
        'total_keywords', COUNT(*),
        'immediate_keywords', COUNT(*) FILTER (WHERE classification = 'immediate'),
        'later_keywords', COUNT(*) FILTER (WHERE classification = 'later'),
        'service_types', jsonb_agg(DISTINCT service_type) FILTER (WHERE service_type IS NOT NULL),
        'regions', jsonb_agg(DISTINCT region) FILTER (WHERE region IS NOT NULL),
        'last_updated', MAX(created_at)
    )
    FROM rag_individual_keywords
    WHERE is_active = TRUE;
$$;

-- キーワード正規化関数（日本語対応）
CREATE OR REPLACE FUNCTION normalize_keyword(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
    -- 基本的な正規化処理
    RETURN TRIM(
        REGEXP_REPLACE(
            LOWER(input_text),
            '\s+', ' ', 'g'  -- 複数の空白を単一の空白に変換
        )
    );
END;
$$;