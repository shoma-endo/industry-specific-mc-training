-- Remove nav menu related content types from stored WordPress settings
update public.wordpress_settings
  set wp_content_types = array_remove(
    array_remove(array_remove(wp_content_types, 'nav_menu_item'), 'menu-item'),
    'menu-items'
  )
  where wp_content_types && array['nav_menu_item','menu-item','menu-items']::text[];

-- Rollback plan:
-- update public.wordpress_settings
--   set wp_content_types = wp_content_types || array['nav_menu_item']::text[] -- manual review required
