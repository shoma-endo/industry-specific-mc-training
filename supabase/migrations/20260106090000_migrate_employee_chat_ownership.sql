-- Move staff-owned chat data to the owner user_id (staff invitations only)
begin;

with employee_map as (
  select id as employee_id, owner_user_id
  from public.users
  where owner_user_id is not null
)
update public.chat_sessions cs
set user_id = em.owner_user_id
from employee_map em
where cs.user_id = em.employee_id;

with employee_map as (
  select id as employee_id, owner_user_id
  from public.users
  where owner_user_id is not null
)
update public.chat_messages cm
set user_id = em.owner_user_id
from employee_map em
join public.chat_sessions cs on cs.id = cm.session_id
where cm.user_id = em.employee_id
  and cs.user_id = em.owner_user_id;

with employee_map as (
  select id as employee_id, owner_user_id
  from public.users
  where owner_user_id is not null
),
eligible_annotations as (
  select ca.id, em.owner_user_id
  from public.content_annotations ca
  join employee_map em on ca.user_id = em.employee_id
  where not exists (
    select 1
    from public.content_annotations ca2
    where ca2.user_id = em.owner_user_id
      and ca2.wp_post_id = ca.wp_post_id
  )
  and (
    ca.canonical_url is null
    or not exists (
      select 1
      from public.content_annotations ca2
      where ca2.user_id = em.owner_user_id
        and ca2.canonical_url = ca.canonical_url
    )
  )
)
update public.content_annotations ca
set user_id = ea.owner_user_id
from eligible_annotations ea
where ca.id = ea.id;

commit;

-- Rollback:
-- データ移行のため自動ロールバック不可。必要に応じて事前バックアップから復元してください。
