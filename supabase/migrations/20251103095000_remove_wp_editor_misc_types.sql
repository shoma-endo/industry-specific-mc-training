-- Normalize wp_content_types to remove Gutenberg/core/editor-only or Jetpack types
update public.wordpress_settings
  set wp_content_types = coalesce(
    (
      select array_agg(elem)
      from unnest(coalesce(wp_content_types, array[]::text[])) as elem
      where lower(elem) not in (
        'attachment',
        'media',
        'feedback',
        'wp_block',
        'wp-template',
        'wp_template',
        'wp_template_part',
        'wp-template-part',
        'wp_global_styles',
        'wp-global-styles',
        'wp_navigation',
        'wp-navigation',
        'wp_font_family',
        'wp-font-family',
        'wp_font_face',
        'wp-font-face',
        'wp_pattern',
        'wp-pattern',
        'nav_menu_item',
        'menu-item',
        'menu-items',
        'jp_pay_order',
        'jp-pay-order',
        'jp_pay_product',
        'jp-pay-product'
      )
      and lower(elem) not like 'wp\_%'
      and lower(elem) not like 'wp-%'
      and lower(elem) not like 'jp\_%'
      and lower(elem) not like 'jp-%'
    ),
    array[]::text[]
  )
  where wp_content_types is not null;

-- Rollback plan:
-- -- 手動で対象タイプを再追加する必要があります（元データが不要タイプであったため）。
