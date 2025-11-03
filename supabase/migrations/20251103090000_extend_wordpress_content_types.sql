-- Add wp_post_type column to content_annotations for storing WordPress post types
alter table if exists public.content_annotations
  add column if not exists wp_post_type text default 'posts';

update public.content_annotations
  set wp_post_type = coalesce(nullif(trim(wp_post_type), ''), 'posts');

alter table if exists public.content_annotations
  alter column wp_post_type set not null;

-- Add wp_content_types column to wordpress_settings to track target post types
alter table if exists public.wordpress_settings
  add column if not exists wp_content_types text[] default array['posts','pages']::text[];

update public.wordpress_settings
  set wp_content_types = case
    when wp_content_types is null or array_length(wp_content_types, 1) = 0 then array['posts','pages']::text[]
    else wp_content_types
  end;

alter table if exists public.wordpress_settings
  alter column wp_content_types set not null;

-- Rollback plan:
-- alter table if exists public.content_annotations drop column if exists wp_post_type;
-- alter table if exists public.wordpress_settings drop column if exists wp_content_types;
