-- Add current_suggestion_stage column to gsc_article_evaluations table
-- GSC改善提案のステージ管理（段階的エスカレーション）

-- gsc_article_evaluations テーブルに current_suggestion_stage カラムを追加
alter table public.gsc_article_evaluations
  add column current_suggestion_stage smallint not null default 1
  check (current_suggestion_stage between 1 and 4);

-- カラムコメント
comment on column public.gsc_article_evaluations.current_suggestion_stage is
  '改善提案のステージ（1:タイトル/説明文のみ、2:タイトル/説明文+書き出し、3:タイトル/説明文+書き出し+本文、4:ペルソナから全て変更）';

-- Rollback instructions:
-- alter table public.gsc_article_evaluations
--   drop column current_suggestion_stage;
