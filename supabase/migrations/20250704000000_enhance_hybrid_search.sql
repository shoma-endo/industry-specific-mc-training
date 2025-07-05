-- 改良版ハイブリッド検索関数（動的重み付け対応）
CREATE OR REPLACE FUNCTION advanced_hybrid_search(
    search_text TEXT,
    query_embedding VECTOR(1536),
    context_type TEXT DEFAULT 'general',
    vector_weight FLOAT DEFAULT 0.7,
    text_weight FLOAT DEFAULT 0.3,
    similarity_threshold FLOAT DEFAULT 0.5,
    result_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    keyword TEXT,
    classification VARCHAR(20),
    similarity FLOAT,
    text_rank FLOAT,
    combined_score FLOAT,
    service_type VARCHAR(50),
    region VARCHAR(50)
)
LANGUAGE SQL STABLE
AS $$
    WITH vector_results AS (
        SELECT 
            keyword,
            classification,
            service_type,
            region,
            1 - (keyword_embedding <=> query_embedding) AS similarity,
            0.0 as text_rank
        FROM rag_individual_keywords
        WHERE 
            is_active = TRUE 
            AND keyword_embedding IS NOT NULL
            AND 1 - (keyword_embedding <=> query_embedding) > similarity_threshold
        ORDER BY similarity DESC
        LIMIT result_limit * 3
    ),
    text_results AS (
        SELECT 
            keyword,
            classification,
            service_type,
            region,
            0.0 as similarity,
            ts_rank(to_tsvector('simple', keyword), plainto_tsquery('simple', search_text)) AS text_rank
        FROM rag_individual_keywords
        WHERE 
            is_active = TRUE 
            AND to_tsvector('simple', keyword) @@ plainto_tsquery('simple', search_text)
        ORDER BY text_rank DESC
        LIMIT result_limit * 3
    ),
    combined AS (
        SELECT 
            keyword,
            classification,
            service_type,
            region,
            MAX(similarity) as similarity,
            MAX(text_rank) as text_rank,
            -- 動的重み付け
            CASE 
                WHEN context_type = 'local' THEN MAX(similarity) * 0.8 + MAX(text_rank) * 0.2
                WHEN context_type = 'service' THEN MAX(similarity) * 0.6 + MAX(text_rank) * 0.4
                ELSE MAX(similarity) * vector_weight + MAX(text_rank) * text_weight
            END as combined_score
        FROM (
            SELECT * FROM vector_results
            UNION ALL
            SELECT * FROM text_results
        ) results
        GROUP BY keyword, classification, service_type, region
        HAVING MAX(similarity) > similarity_threshold OR MAX(text_rank) > 0.1
    )
    SELECT * FROM combined
    ORDER BY combined_score DESC
    LIMIT result_limit;
$$;

-- 類似性に基づく多様性を考慮したリランキング関数
CREATE OR REPLACE FUNCTION diversity_rerank_search(
    search_text TEXT,
    query_embedding VECTOR(1536),
    diversity_threshold FLOAT DEFAULT 0.8,
    result_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    keyword TEXT,
    classification VARCHAR(20),
    similarity FLOAT,
    text_rank FLOAT,
    combined_score FLOAT,
    diversity_score FLOAT,
    final_score FLOAT
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    selected_results TEXT[] := ARRAY[]::TEXT[];
    current_keyword TEXT;
    current_diversity FLOAT;
BEGIN
    -- 初期検索結果を取得
    FOR current_keyword IN
        SELECT k.keyword
        FROM advanced_hybrid_search(
            search_text, 
            query_embedding, 
            'general', 
            0.7, 
            0.3, 
            0.5, 
            result_limit * 2
        ) k
        ORDER BY k.combined_score DESC
    LOOP
        -- 多様性スコアを計算
        SELECT calculate_diversity_score(current_keyword, selected_results) INTO current_diversity;
        
        -- 多様性閾値を満たす場合のみ選択
        IF current_diversity >= diversity_threshold OR array_length(selected_results, 1) IS NULL THEN
            selected_results := array_append(selected_results, current_keyword);
            
            -- 必要な数だけ選択されたら終了
            IF array_length(selected_results, 1) >= result_limit THEN
                EXIT;
            END IF;
        END IF;
    END LOOP;
    
    -- 最終結果を返す
    RETURN QUERY
    SELECT 
        k.keyword,
        k.classification,
        k.similarity,
        k.text_rank,
        k.combined_score,
        calculate_diversity_score(k.keyword, selected_results) as diversity_score,
        k.combined_score * 0.8 + calculate_diversity_score(k.keyword, selected_results) * 0.2 as final_score
    FROM advanced_hybrid_search(
        search_text, 
        query_embedding, 
        'general', 
        0.7, 
        0.3, 
        0.5, 
        result_limit * 2
    ) k
    WHERE k.keyword = ANY(selected_results)
    ORDER BY final_score DESC;
END;
$$;

-- 多様性スコア計算関数
CREATE OR REPLACE FUNCTION calculate_diversity_score(
    target_keyword TEXT,
    selected_keywords TEXT[]
)
RETURNS FLOAT
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    min_similarity FLOAT := 1.0;
    current_similarity FLOAT;
    selected_keyword TEXT;
BEGIN
    -- 選択済みキーワードがない場合は最高スコア
    IF array_length(selected_keywords, 1) IS NULL THEN
        RETURN 1.0;
    END IF;
    
    -- 各選択済みキーワードとの類似度を計算し、最小値を求める
    FOREACH selected_keyword IN ARRAY selected_keywords
    LOOP
        SELECT similarity(target_keyword, selected_keyword) INTO current_similarity;
        min_similarity := LEAST(min_similarity, current_similarity);
    END LOOP;
    
    -- 最小類似度を多様性スコアとして返す（類似度が低いほど多様性が高い）
    RETURN 1.0 - min_similarity;
END;
$$;

-- コンテキスト対応検索関数
CREATE OR REPLACE FUNCTION contextual_keyword_search(
    search_text TEXT,
    query_embedding VECTOR(1536),
    user_context JSONB DEFAULT '{}',
    result_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    keyword TEXT,
    classification VARCHAR(20),
    similarity FLOAT,
    text_rank FLOAT,
    combined_score FLOAT,
    context_boost FLOAT,
    final_score FLOAT
)
LANGUAGE SQL STABLE
AS $$
    WITH base_results AS (
        SELECT 
            k.keyword,
            k.classification,
            k.similarity,
            k.text_rank,
            k.combined_score,
            k.service_type,
            k.region
        FROM advanced_hybrid_search(
            search_text, 
            query_embedding, 
            'general', 
            0.7, 
            0.3, 
            0.5, 
            result_limit * 2
        ) k
    ),
    context_boosted AS (
        SELECT 
            *,
            -- コンテキストブーストの計算
            CASE 
                WHEN user_context->>'preferred_region' IS NOT NULL 
                     AND region = user_context->>'preferred_region' THEN 0.2
                WHEN user_context->>'service_type' IS NOT NULL 
                     AND service_type = user_context->>'service_type' THEN 0.15
                ELSE 0.0
            END as context_boost
        FROM base_results
    )
    SELECT 
        keyword,
        classification,
        similarity,
        text_rank,
        combined_score,
        context_boost,
        combined_score + context_boost as final_score
    FROM context_boosted
    ORDER BY final_score DESC
    LIMIT result_limit;
$$;