-- supabase/migrations/20250902103000_add_session_id_to_content_annotations.sql

-- content_annotationsテーブルにsession_idカラムを追加
alter table public.content_annotations add column if not exists session_id text;

-- ユーザーIDとセッションIDの組み合わせでユニーク制約を追加（1セッション1行を担保）
create unique index if not exists uq_content_annotations_user_session
  on public.content_annotations(user_id, session_id)
  where session_id is not null;

-- wp_post_idまたはsession_idのどちらかが必須であることを保証する制約
alter table public.content_annotations
  add constraint content_annotations_key_presence_chk
  check (wp_post_id is not null or session_id is not null);