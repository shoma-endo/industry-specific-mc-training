-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- RAG学習データテーブル
CREATE TABLE rag_training_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 元データ
    input_keywords TEXT[] NOT NULL, -- 入力キーワード配列
    output_classification JSONB NOT NULL, -- 分類結果
    
    -- 検索用データ
    combined_content TEXT NOT NULL, -- 検索用統合テキスト
    embedding VECTOR(1536), -- OpenAI embedding
    
    -- メタデータ
    total_keywords INTEGER NOT NULL,
    immediate_count INTEGER DEFAULT 0,
    later_count INTEGER DEFAULT 0,
    
    -- 統計情報
    keyword_stats JSONB DEFAULT '{}', -- 地域、サービス種別等の統計
    
    -- 管理情報
    data_source VARCHAR(50) DEFAULT 'finetune', -- データソース
    confidence_score FLOAT DEFAULT 1.0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 個別キーワードテーブル（高速検索用）
CREATE TABLE rag_individual_keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    training_data_id UUID REFERENCES rag_training_data(id) ON DELETE CASCADE,
    
    -- キーワード情報
    keyword TEXT NOT NULL,
    normalized_keyword TEXT NOT NULL, -- 正規化済み
    classification VARCHAR(20) NOT NULL, -- 'immediate' or 'later'
    keyword_embedding VECTOR(1536),
    
    -- 構造化メタデータ
    service_type VARCHAR(50),
    region VARCHAR(50),
    has_region BOOLEAN DEFAULT FALSE,
    has_urgency BOOLEAN DEFAULT FALSE,
    has_price_info BOOLEAN DEFAULT FALSE,
    
    -- 管理情報
    confidence_score FLOAT DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) ポリシー
ALTER TABLE rag_training_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_individual_keywords ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: 管理者のみアクセス可能
CREATE POLICY "Admin access only" ON rag_training_data
    FOR ALL TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin')
    WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin access only" ON rag_individual_keywords
    FOR ALL TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin')
    WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- サービスロール用のポリシー（バックエンドからのアクセス用）
CREATE POLICY "Service role access" ON rag_training_data
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role access" ON rag_individual_keywords
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- インデックス作成
CREATE INDEX rag_training_embedding_idx ON rag_training_data 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX rag_individual_embedding_idx ON rag_individual_keywords 
USING ivfflat (keyword_embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX rag_individual_keyword_idx ON rag_individual_keywords (normalized_keyword);
CREATE INDEX rag_individual_classification_idx ON rag_individual_keywords (classification);
CREATE INDEX rag_individual_service_type_idx ON rag_individual_keywords (service_type);

-- フルテキスト検索インデックス
CREATE INDEX rag_training_fts_idx ON rag_training_data 
USING GIN (to_tsvector('japanese', combined_content));

CREATE INDEX rag_individual_fts_idx ON rag_individual_keywords 
USING GIN (to_tsvector('japanese', keyword));

-- 更新日時の自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_rag_training_data_updated_at 
    BEFORE UPDATE ON rag_training_data 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();