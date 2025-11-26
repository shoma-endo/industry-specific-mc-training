-- Rename next_evaluation_on to base_evaluation_date
-- 評価基準日（ベース日）を明確化するためのカラム名変更

-- gsc_article_evaluations テーブルの next_evaluation_on を base_evaluation_date にリネーム
alter table public.gsc_article_evaluations
  rename column next_evaluation_on to base_evaluation_date;

-- Rollback instructions:
-- alter table public.gsc_article_evaluations
--   rename column base_evaluation_date to next_evaluation_on;
