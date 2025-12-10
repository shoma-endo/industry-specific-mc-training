-- Add evaluation_hour column to gsc_article_evaluations table
-- 評価実行時間（0-23の整数、日本時間）

alter table public.gsc_article_evaluations
  add column evaluation_hour smallint not null default 12
  check (evaluation_hour >= 0 and evaluation_hour <= 23);

-- カラムコメント
comment on column public.gsc_article_evaluations.evaluation_hour is '評価実行時間（0-23、日本時間）';

-- Rollback instructions:
-- alter table public.gsc_article_evaluations
--   drop column evaluation_hour;

