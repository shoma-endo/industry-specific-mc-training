-- Change wp_content_types default to an empty array and clear legacy defaults
alter table if exists public.wordpress_settings
  alter column wp_content_types set default array[]::text[];

update public.wordpress_settings
  set wp_content_types = array[]::text[]
  where wp_content_types is null
     or wp_content_types = array['posts','pages']::text[];

-- Rollback plan:
-- alter table if exists public.wordpress_settings
--   alter column wp_content_types set default array['posts','pages']::text[];
