-- RPCs to upsert user profile and brief without overwriting created_at

create or replace function public.upsert_user_profile(
  p_line_user_id text,
  p_line_display_name text,
  p_line_picture_url text,
  p_line_status_message text,
  p_now timestamptz
)
returns setof public.users
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (
    id,
    line_user_id,
    line_display_name,
    line_picture_url,
    line_status_message,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    p_line_user_id,
    p_line_display_name,
    p_line_picture_url,
    p_line_status_message,
    p_now,
    p_now
  )
  on conflict (line_user_id) do update
    set line_display_name = excluded.line_display_name,
        line_picture_url = excluded.line_picture_url,
        line_status_message = excluded.line_status_message,
        updated_at = excluded.updated_at;

  return query
    select *
      from public.users
     where line_user_id = p_line_user_id;
end;
$$;

create or replace function public.upsert_brief(
  p_user_id text,
  p_data jsonb,
  p_now timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.briefs (
    user_id,
    data,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    p_data,
    p_now,
    p_now
  )
  on conflict (user_id) do update
    set data = excluded.data,
        updated_at = excluded.updated_at;
end;
$$;

-- Rollback plan:
-- drop function if exists public.upsert_user_profile(text, text, text, text, timestamptz);
-- drop function if exists public.upsert_brief(text, jsonb, timestamptz);
