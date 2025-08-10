-- Drop RAG-related functions (if exist)
DO $$ BEGIN
  PERFORM 1 FROM pg_proc WHERE proname = 'get_keyword_statistics';
  IF FOUND THEN EXECUTE 'DROP FUNCTION get_keyword_statistics();'; END IF;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  PERFORM 1 FROM pg_proc WHERE proname = 'search_similar_keywords';
  IF FOUND THEN EXECUTE 'DROP FUNCTION search_similar_keywords(VECTOR, FLOAT, INTEGER);'; END IF;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  PERFORM 1 FROM pg_proc WHERE proname = 'hybrid_keyword_search';
  IF FOUND THEN EXECUTE 'DROP FUNCTION hybrid_keyword_search(TEXT, VECTOR, INTEGER);'; END IF;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  PERFORM 1 FROM pg_proc WHERE proname = 'search_training_data';
  IF FOUND THEN EXECUTE 'DROP FUNCTION search_training_data(VECTOR, FLOAT, INTEGER);'; END IF;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- Drop indexes if exist
DO $$ BEGIN EXECUTE 'DROP INDEX IF EXISTS rag_individual_fts_idx'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'DROP INDEX IF EXISTS rag_individual_service_type_idx'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'DROP INDEX IF EXISTS rag_individual_classification_idx'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'DROP INDEX IF EXISTS rag_individual_keyword_idx'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'DROP INDEX IF EXISTS rag_individual_embedding_idx'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'DROP INDEX IF EXISTS rag_training_fts_idx'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'DROP INDEX IF EXISTS rag_training_embedding_idx'; EXCEPTION WHEN others THEN NULL; END $$;

-- Drop trigger and helper function if exist
DO $$ BEGIN EXECUTE 'DROP TRIGGER IF EXISTS update_rag_training_data_updated_at ON rag_training_data'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  PERFORM 1 FROM pg_proc WHERE proname = 'update_updated_at_column';
  IF FOUND THEN EXECUTE 'DROP FUNCTION update_updated_at_column();'; END IF;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- Drop tables if exist
DROP TABLE IF EXISTS rag_individual_keywords CASCADE;
DROP TABLE IF EXISTS rag_training_data CASCADE;

