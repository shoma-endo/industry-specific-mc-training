-- ga4_page_metrics_daily テーブルの bounce_rate に範囲制約を追加
-- GA4 API の bounce_rate は 0〜1 の小数値
alter table public.ga4_page_metrics_daily
  add constraint ga4_bounce_rate_range check (bounce_rate >= 0 and bounce_rate <= 1);
-- Rollback: alter table public.ga4_page_metrics_daily drop constraint ga4_bounce_rate_range;
