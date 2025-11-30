-- Add cycle_days column to gsc_article_evaluations table
-- 評価サイクル日数をユーザーが設定できるようにする

-- gsc_article_evaluations テーブルに cycle_days カラムを追加
alter table public.gsc_article_evaluations
  add column cycle_days integer not null default 30 check (cycle_days between 1 and 365);

-- カラムコメント
comment on column public.gsc_article_evaluations.cycle_days is '評価サイクル日数（デフォルト30日、1-365日の範囲）';

-- Rollback instructions:
-- alter table public.gsc_article_evaluations
--   drop column cycle_days;
