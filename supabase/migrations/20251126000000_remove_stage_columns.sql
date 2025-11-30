-- Remove stage columns from GSC evaluation tables
-- エスカレーションレベル（ステージ）機能を削除

-- gsc_article_evaluations テーブルから current_stage を削除
alter table public.gsc_article_evaluations
  drop column if exists current_stage;

-- gsc_article_evaluation_history テーブルから stage を削除
alter table public.gsc_article_evaluation_history
  drop column if exists stage;

-- Rollback instructions:
-- alter table public.gsc_article_evaluations
--   add column current_stage smallint not null default 1 check (current_stage between 1 and 4);
--
-- alter table public.gsc_article_evaluation_history
--   add column stage smallint not null check (stage between 1 and 4);
