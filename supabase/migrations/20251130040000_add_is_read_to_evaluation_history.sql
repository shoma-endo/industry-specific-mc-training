-- Add is_read column to gsc_article_evaluation_history table
-- 改善提案の未読管理用フラグ

alter table public.gsc_article_evaluation_history
  add column is_read boolean not null default false;

-- カラムコメント
comment on column public.gsc_article_evaluation_history.is_read is '改善提案の既読フラグ（デフォルトfalse=未読）';

-- インデックス（未読検索用）
create index if not exists idx_gsc_article_eval_history_unread
  on public.gsc_article_evaluation_history(user_id, is_read)
  where is_read = false;

-- Rollback instructions:
-- drop index if exists idx_gsc_article_eval_history_unread;
-- alter table public.gsc_article_evaluation_history
--   drop column is_read;

