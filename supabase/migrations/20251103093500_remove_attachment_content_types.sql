-- Remove unsupported WordPress content types such as attachments/media from stored settings
update public.wordpress_settings
  set wp_content_types = array_remove(array_remove(wp_content_types, 'attachment'), 'media')
  where wp_content_types && array['attachment','media']::text[];

-- Rollback plan:
-- update public.wordpress_settings
--   set wp_content_types = wp_content_types || array['media']::text[] -- re-adding would need manual review
