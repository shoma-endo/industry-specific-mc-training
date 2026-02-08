# Google Ads評価機能 基本設計書

## 1. 目的

- `keyword_view` を用いて、キーワード単位で広告状態を評価し改善提案を提示する。
- 評価結果を `app/google-ads-dashboard/page.tsx` から遷移できる専用画面で確認可能にする。
- 通知挙動は既存 Search Console 評価機能と同一ルールに合わせる（配色のみ Google Ads 用に分離）。

## 2. スコープ（初期リリース）

- 評価単位は `customer_id + keyword_id`。
- 評価対象期間は初期値として「前日基準」を採用する。
- 品質スコアの比較は「評価開始時のベースライン」と「前日取得値」の比較で判定する（将来拡張で14日間トレンド比較を追加）。
- コンバージョン数・CVRは「評価開始日以降の累積値」に基づいて判定する。
- 評価対象指標は `CTR / 品質スコア / コンバージョン数 / CVR / CPA`。
- `CPC` と `検索インプレッションシェア` は表示対象とし、評価提案ロジックには使用しない。
- 日付判定は **JST基準** で行う（`(now() at time zone 'Asia/Tokyo')::date`）。DBデフォルトのタイムゾーンに依存しない。

## 3. 画面設計

### 3.1 画面構成

- 追加画面: `app/google-ads-evaluations/page.tsx`
- 遷移元: `app/google-ads-dashboard/page.tsx` に「評価結果を見る」導線を追加

### 3.2 一覧表示項目

| 項目 | 説明 |
|------|------|
| Keyword | キーワードテキスト |
| キャンペーン | 所属キャンペーン名 |
| 判定ステータス | `healthy` / `needs_improvement` / `error` |
| 提案要約 | 該当した指標の要約（例: 「CTR低下、CVR不足」） |
| 累積Clicks | 評価開始以降の累積クリック数 |
| 累積Conversions | 評価開始以降の累積コンバージョン数 |
| 前日CTR | 前日のCTR値（%表示） |
| 品質スコア | 前日取得値 |
| 最終評価日時 | 最後に評価を実行した日時 |
| 既読状態 | 未読 / 既読 |

### 3.3 詳細表示項目

- 判定理由（どの指標が条件に該当したか）
- 使用閾値（CTR: 5%, CVR: 1%, CPA: ○○円 等）
- 前日実績（各指標の数値）
- 累積実績（評価開始日〜前日の累積クリック数・コンバージョン数）
- 提案本文

### 3.4 通知UI

- Search Console 評価通知と同一挙動を採用
- Google Ads 評価通知は色のみ変更して視覚的に区別（GSC: 青系、Google Ads: 緑系 等）
- GSC通知とGoogle Ads通知が同時に存在する場合は **それぞれ独立してトーストを表示** する（表示間隔を500ms空ける）

## 4. 評価ロジック（初期値）

### 4.0 値域定義

実装時の混乱を避けるため、DB格納値と閾値の対応を明示する。

| 指標 | DB格納値域 | 要件上の閾値 | DB上の閾値 | 比較演算 |
|------|-----------|-------------|-----------|---------|
| CTR | `0.000000` 〜 `1.000000` | 5% | `0.050000` | `< 0.05` で提案 |
| CVR | `0.000000` 〜 `1.000000` | 1% | `0.010000` | `<= 0.01` で提案 |
| CPA | 円単位（整数） | 要相談 | 設定テーブル参照 | `> threshold` で提案 |
| 品質スコア | `1` 〜 `10`（整数） | — | ベースライン比較 | `<= baseline` で提案 |

### 4.1 CTR

- **前日** の CTR が `0.05`（5%）未満なら改善提案を出す
- 対象: 前日に1回以上のインプレッションがあるキーワードのみ

### 4.2 品質スコア

- **比較方式**: 評価開始時に記録した `baseline_quality_score` と前日取得値を比較する
- 前日値が **ベースラインと同じ、または低下** している場合に改善提案を出す
- 品質スコアが `10`（最高値）の場合は提案不要
- 品質スコアが `null`（未算出）の場合は評価スキップ
- 将来拡張: `quality_score_lookback_days` を導入し、過去N日間のトレンドで判定するモードを追加

### 4.3 コンバージョン数

- **評価開始日以降の累積** で判定する
- `累積クリック数 >= 50` かつ `累積コンバージョン数 = 0` の場合に改善提案を出す
- 累積クリック数が50未満の場合は「データ蓄積中」として評価スキップ

### 4.4 CVR

- **評価開始日以降の累積** で判定する
- `累積クリック数 >= 50` かつ `累積CVR <= 0.01`（1%）の場合に改善提案を出す
- 累積CVR = `累積コンバージョン数 / 累積クリック数`
- 累積クリック数が50未満の場合は「データ蓄積中」として評価スキップ

### 4.5 CPA

- 前日の `CPA > 設定閾値` の場合に改善提案を出す
- 初期リリースでは CPA 評価を **無効（閾値未設定）** とし、ユーザー設定画面の実装後に有効化する
- 理由: 市場・業種によって適正CPAが大幅に異なるため、固定値では誤判定リスクが高い
- 設定テーブルに `cpa_threshold_yen` カラムは予約しておく（`null` = 評価無効）

### 4.6 総合判定

- 1件以上の提案条件に該当: `needs_improvement`
- すべて非該当（データ蓄積中を含む）: `healthy`
- API取得失敗: `error`

## 5. データ設計（論理）

GSC評価機能と同様に **設定テーブル + 履歴テーブル** の2テーブル構成を採用する。

### 5.1 評価設定テーブル（新規）

- テーブル名: `google_ads_keyword_evaluation_settings`
- 役割: キーワード単位の評価設定・累積値・閾値を保持する
- 一意制約: `(user_id, customer_id, keyword_id)`

#### 主な保持項目

| カラム | 用途 |
|--------|------|
| `user_id` | 所有ユーザー |
| `customer_id` | Google Ads カスタマーID |
| `keyword_id` | キーワードID |
| `keyword_text` | キーワードテキスト（表示用） |
| `campaign_name` | キャンペーン名（表示用） |
| `evaluation_start_date` | 評価開始日（累積の起算日） |
| `cumulative_clicks` | 評価開始日以降の累積クリック数 |
| `cumulative_conversions` | 評価開始日以降の累積コンバージョン数 |
| `baseline_quality_score` | 評価開始時の品質スコア（比較基準） |
| `ctr_threshold` | CTR閾値（デフォルト: 0.05） |
| `cvr_threshold` | CVR閾値（デフォルト: 0.01） |
| `cpa_threshold_yen` | CPA閾値（null = 評価無効） |
| `click_threshold` | クリック数閾値（デフォルト: 50） |
| `quality_score_lookback_days` | 品質スコア比較期間（デフォルト: 1、将来拡張用） |
| `last_evaluated_on` | 最終評価日（二重実行防止に使用） |
| `status` | `active` / `paused` |

### 5.2 評価履歴テーブル（新規）

- テーブル名: `google_ads_keyword_evaluation_history`
- 役割: 評価実行ごとのスナップショットと判定結果を保持する
- 主キー相当: `(user_id, customer_id, keyword_id, evaluated_at)`

#### 主な保持項目

| カラム | 用途 |
|--------|------|
| `user_id` | 所有ユーザー |
| `customer_id` | Google Ads カスタマーID |
| `keyword_id` | キーワードID |
| `keyword_text` | キーワードテキスト |
| `evaluated_at` | 評価実行日時 |
| `daily_clicks` | 前日クリック数 |
| `daily_impressions` | 前日インプレッション数 |
| `daily_cost_micros` | 前日費用（micros） |
| `daily_ctr` | 前日CTR |
| `quality_score` | 前日品質スコア |
| `daily_conversions` | 前日コンバージョン数 |
| `daily_cvr` | 前日CVR |
| `daily_cpa_micros` | 前日CPA（micros） |
| `cumulative_clicks` | 評価開始日以降の累積クリック数（スナップショット） |
| `cumulative_conversions` | 評価開始日以降の累積コンバージョン数（スナップショット） |
| `status` | `healthy` / `needs_improvement` / `error` |
| `triggered_rules` | 該当した評価ルール名の配列（例: `["ctr","cvr"]`） |
| `suggestions` | 提案内容（JSON） |
| `is_read` | 未読 / 既読 |

### 5.3 既読管理

- Search Console と同様、`is_read` で未読/既読を管理
- 既読化は履歴テーブル側で行う

## 6. 通知設計（Search Console準拠）

### 6.1 未読判定

- `is_read = false` かつ `status = 'needs_improvement'`

### 6.2 表示ルール

- グローバルトーストで未読件数を表示
- クリックで Google Ads 評価一覧へ遷移
- GSC通知とは独立して表示する（色で視覚的に区別）

### 6.3 GSC通知との共存

- `GscNotificationHandler` と同パターンで `GoogleAdsNotificationHandler` を新設
- 両者を `NotificationProvider` 等の共通ラッパーでまとめ、表示間隔を制御（500ms間隔）
- カスタムイベント名: `google-ads-unread-updated`（GSCの `gsc-unread-updated` と独立）

### 6.4 再通知ルール

- セッション中は1回表示
- 未読件数更新イベントで再評価・再表示

### 6.5 既読処理

- 個別既読
- 一括既読
- 未読件数が0になったら通知を非表示

## 7. サーバー構成

### 7.1 新設ファイル

| ファイル | 役割 |
|---------|------|
| `src/server/services/googleAdsEvaluationService.ts` | 評価ロジック（判定・累積更新・履歴保存） |
| `src/server/actions/googleAdsEvaluation.actions.ts` | 一覧取得 / 未読件数取得 / 既読更新 / 手動評価実行 |
| `src/server/actions/googleAdsNotification.actions.ts` | 通知用アクション（未読件数・既読化） |

### 7.2 既存ファイルへの追加

| ファイル | 変更内容 |
|---------|---------|
| `src/types/googleAds.types.ts` | 評価設定・履歴・通知用の `interface` を追加 |
| `src/components/GoogleAdsNotificationHandler.tsx` | 新設。通知トースト表示コンポーネント |

### 7.3 評価フロー

```
ダッシュボード表示
  ↓
today_jst = (now() at time zone 'Asia/Tokyo')::date
yesterday_jst = today_jst - 1
  ↓
設定テーブルの last_evaluated_on < today_jst かチェック
  ↓ (未評価の場合)
Google Ads API から yesterday_jst のキーワード指標を取得
  ↓
キーワードごとに（Service Role で実行）:
  1. 前日指標を設定テーブルの累積値に加算
  2. 各評価ルールを適用（CTR / 品質スコア / コンバージョン数 / CVR / CPA）
  3. 判定結果を履歴テーブルに保存（Service Role INSERT）
  4. 設定テーブルの last_evaluated_on を today_jst に更新
  ↓
通知イベント発火
```

## 8. 実行タイミング

### 8.1 初期リリース

- ダッシュボード表示時に前日評価を実行する
- **二重実行防止**: 設定テーブルの `last_evaluated_on >= (now() at time zone 'Asia/Tokyo')::date` であればスキップ
- 手動実行ボタンも提供（`force: true` で `last_evaluated_on` チェックを無視）

### 8.2 将来拡張

- 定時バッチ（cron）へ切替可能な構成にする
- GSCと同様に `evaluation_hour`（実行時間 JST）を設定テーブルに追加可能

## 9. エラーハンドリング方針

- API取得失敗時は評価結果を `error` として履歴保存し通知対象外とする
- 累積値の加算は行わない（エラー時はスキップ）
- UI上は「評価不可（再実行待ち）」を表示する
- 原因特定はサーバーログで行う
- 設定テーブルの `last_evaluated_on` はエラー時も更新する（無限リトライ防止）

## 10. テスト観点

- 判定ロジック単体テスト（閾値境界: CTR 0.049999/0.050000、CVR 0.010000/0.010001）
- 累積値の加算テスト（複数日にわたる評価の累積が正しいか）
- 品質スコアのベースライン比較テスト（同値/低下/向上/null/10）
- 二重実行防止テスト（同日に2回実行した場合にスキップされるか）
- 通知表示テスト（未読件数の増減、GSC通知との共存）
- 既読処理テスト（個別・一括）
- 画面遷移テスト（ダッシュボード→評価一覧）
- エラー時の累積値非加算テスト
- JST日跨ぎテスト（UTC 15:00 = JST 0:00 前後で正しく日付判定されるか）
- SECURITY DEFINER 関数テスト（is_read 以外のカラムが変更されないこと）
- SECURITY DEFINER 関数テスト（role='owner' が RPC 実行した場合に例外が発生すること）
- サービスロール経由INSERT テスト（スタッフがオーナー配下データを評価実行できること）

## 11. 将来拡張（本設計対象外）

- 閾値のユーザー設定化（CTR/CVR/CPA/クリック数閾値）
- 品質スコア評価期間の14日比較モード追加（`quality_score_lookback_days` カラムで制御）
- 評価対象期間のユーザー設定化
- 業種別テンプレート閾値
- 提案文のAI最適化（LLMによる改善提案生成）
- 定時バッチ実行（cron）
- 評価開始日のリセット機能（累積値クリア）

## 12. DB物理設計（DDL案）

### 12.1 マイグレーション方針

- 追加先: `supabase/migrations/`
- ファイル名例: `20260209_create_google_ads_keyword_evaluation_tables.sql`
- ロールバック案はマイグレーションSQL内にコメントで併記する

### 12.2 評価設定テーブル

```sql
-- 評価設定テーブル: キーワード単位の評価設定・累積値・閾値を管理
-- ロールバック: drop table if exists public.google_ads_keyword_evaluation_settings cascade;
create table if not exists public.google_ads_keyword_evaluation_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id text not null,
  keyword_id text not null,
  keyword_text text not null,
  campaign_name text not null default '',

  -- 評価基準日・累積値
  evaluation_start_date date not null default (now() at time zone 'Asia/Tokyo')::date,
  cumulative_clicks integer not null default 0,
  cumulative_conversions numeric(12,4) not null default 0,
  baseline_quality_score integer,            -- 評価開始時の品質スコア（null = 未取得）

  -- 閾値（将来ユーザー設定化）
  ctr_threshold numeric(8,6) not null default 0.050000,   -- 5%
  cvr_threshold numeric(8,6) not null default 0.010000,   -- 1%
  cpa_threshold_yen integer,                               -- null = CPA評価無効
  click_threshold integer not null default 50,
  quality_score_lookback_days integer not null default 1,  -- 将来拡張用（14日比較等）

  -- 実行管理
  last_evaluated_on date,                    -- 最終評価日（二重実行防止）
  status text not null default 'active' check (status in ('active', 'paused')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 同一ユーザー・アカウント・キーワードの設定は1件のみ
  unique(user_id, customer_id, keyword_id)
);

-- 評価対象キーワードの一覧取得用
create index if not exists google_ads_eval_settings_user_idx
  on public.google_ads_keyword_evaluation_settings (user_id, customer_id, status);

-- 未評価キーワードの検索用（日次評価実行時）
create index if not exists google_ads_eval_settings_due_idx
  on public.google_ads_keyword_evaluation_settings (user_id, last_evaluated_on, status)
  where status = 'active';
```

### 12.3 評価履歴テーブル

```sql
-- 評価履歴テーブル: 評価実行ごとのスナップショットと判定結果を保持
-- ロールバック: drop table if exists public.google_ads_keyword_evaluation_history cascade;
create table if not exists public.google_ads_keyword_evaluation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id text not null,
  keyword_id text not null,
  keyword_text text not null,
  evaluated_at timestamptz not null default now(),

  -- 前日指標（日次スナップショット）
  daily_clicks integer not null default 0,
  daily_impressions integer not null default 0,
  daily_cost_micros bigint not null default 0,
  daily_ctr numeric(8,6),                    -- 0.000000 〜 1.000000
  quality_score integer,                     -- 1〜10、null = 未算出
  daily_conversions numeric(12,4),
  daily_cvr numeric(8,6),                    -- 0.000000 〜 1.000000
  daily_cpa_micros bigint,

  -- 累積スナップショット（評価開始日以降）
  cumulative_clicks integer not null default 0,
  cumulative_conversions numeric(12,4) not null default 0,

  -- 判定結果
  status text not null check (status in ('healthy', 'needs_improvement', 'error')),
  triggered_rules text[] not null default '{}',  -- 該当ルール名: 'ctr','quality_score','conversions','cvr','cpa'
  suggestions jsonb not null default '[]'::jsonb,

  -- エラー情報（status = 'error' の場合）
  error_code text,                           -- 'api_failed','no_metrics','system_error'
  error_message text,

  -- 既読管理
  is_read boolean not null default false,

  created_at timestamptz not null default now()
);
```

### 12.4 インデックス設計

```sql
-- 最新評価の取得（一覧表示用: キーワードごと最新1件）
create index if not exists google_ads_eval_history_latest_idx
  on public.google_ads_keyword_evaluation_history (
    user_id, customer_id, keyword_id, evaluated_at desc
  );

-- 未読提案件数の取得（通知用）
create index if not exists google_ads_eval_history_unread_idx
  on public.google_ads_keyword_evaluation_history (user_id, is_read, status)
  where is_read = false and status = 'needs_improvement';

-- キーワード検索用（必要に応じて）
create index if not exists google_ads_eval_history_keyword_text_idx
  on public.google_ads_keyword_evaluation_history using gin (to_tsvector('simple', keyword_text));
```

### 12.5 重複防止ポリシー

- 設定テーブルの `last_evaluated_on` で日次の二重実行を防止する
- 評価サービスは `WHERE (last_evaluated_on IS NULL OR last_evaluated_on < (now() at time zone 'Asia/Tokyo')::date) AND status = 'active'` で対象を絞り込む
- 手動実行（`force: true`）時のみ `last_evaluated_on` チェックをスキップする
- 履歴テーブルは追記専用（同一日に複数回の履歴が入ることを許容する ← 手動実行時のみ発生）

### 12.6 RLS方針

#### 書き込み操作の実行主体

評価の実行（設定テーブルへの INSERT/UPDATE、履歴テーブルへの INSERT）は **サービスロール**（`supabaseAdmin`）経由で行う。理由:

- 評価サービスはサーバー側バッチ処理であり、`auth.uid()` が評価対象ユーザーと一致しないケースがある（スタッフがオーナー配下データを処理する場合等）
- スタッフの `user_id = auth.uid()` ではオーナーの `user_id` に INSERT できない
- GSC評価サービスと同様に、サービス層で権限チェック済みの上でサービスロールを使用する

したがって、RLS の INSERT/UPDATE ポリシーは **参照系とユーザー直接操作（既読化）のみ** を定義する。

#### 既読化: SECURITY DEFINER 関数

RLS は行単位の制御であり、列単位の更新制限はできない。既読化操作は `is_read` 以外のカラムが改変されるリスクを排除するため、`SECURITY DEFINER` 関数経由で固定する。

```sql
-- ============================================================
-- 既読化関数（SECURITY DEFINER）
-- ============================================================

-- 個別既読
create or replace function public.mark_google_ads_evaluation_as_read(
  p_history_id uuid
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_role text;
begin
  -- オーナー（role='owner'）はDB側で拒否する（閲覧専用ユーザーの書き込み防止）
  select role into v_role from public.users where id = auth.uid();
  if v_role = 'owner' then
    raise exception 'owner role cannot mark evaluations as read';
  end if;

  update public.google_ads_keyword_evaluation_history
  set is_read = true
  where id = p_history_id
    and user_id in (select get_accessible_user_ids(auth.uid()));
end;
$$;

-- 一括既読
create or replace function public.mark_all_google_ads_evaluations_as_read()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_role text;
begin
  -- オーナー（role='owner'）はDB側で拒否する（閲覧専用ユーザーの書き込み防止）
  select role into v_role from public.users where id = auth.uid();
  if v_role = 'owner' then
    raise exception 'owner role cannot mark evaluations as read';
  end if;

  update public.google_ads_keyword_evaluation_history
  set is_read = true
  where user_id in (select get_accessible_user_ids(auth.uid()))
    and is_read = false
    and status = 'needs_improvement';
end;
$$;

-- ============================================================
-- 関数実行権限の制御
-- ============================================================
-- PostgreSQL はデフォルトで PUBLIC に EXECUTE を付与するため、明示的に剥奪する
revoke all on function public.mark_google_ads_evaluation_as_read(uuid) from public;
revoke all on function public.mark_all_google_ads_evaluations_as_read() from public;

-- 認証済みユーザーのみ実行可能にする（関数内で owner ロール拒否済み）
grant execute on function public.mark_google_ads_evaluation_as_read(uuid) to authenticated;
grant execute on function public.mark_all_google_ads_evaluations_as_read() to authenticated;

-- ============================================================
-- RLS ポリシー
-- ============================================================

-- 設定テーブル: 参照ポリシー
create policy "google_ads_eval_settings_select"
  on public.google_ads_keyword_evaluation_settings for select
  using (user_id in (select get_accessible_user_ids(auth.uid())));

-- 設定テーブル: INSERT/UPDATE はサービスロール経由のため RLS ポリシー不要
-- （RLS は enable だが、supabaseAdmin は RLS をバイパスする）

-- 履歴テーブル: 参照ポリシー
create policy "google_ads_eval_history_select"
  on public.google_ads_keyword_evaluation_history for select
  using (user_id in (select get_accessible_user_ids(auth.uid())));

-- 履歴テーブル: INSERT はサービスロール経由のため RLS ポリシー不要

-- 履歴テーブル: UPDATE は SECURITY DEFINER 関数経由のみ許可
-- ユーザー直接の UPDATE は RLS ポリシーを定義しないことで暗黙的に拒否する

-- 注意: オーナー（role='owner'）は get_accessible_user_ids 経由で参照可能だが、
--       既読化は SECURITY DEFINER 関数内で role='owner' を拒否済み（DB層で担保）
--       アプリケーション層でも hasOwnerRole チェックを行い二重防御とする
```

#### サービスロール使用箇所の一覧

| 操作 | 使用ロール | 備考 |
|------|-----------|------|
| 設定テーブル INSERT（評価登録） | Service Role | 評価サービスが実行 |
| 設定テーブル UPDATE（累積値更新・last_evaluated_on更新） | Service Role | 評価サービスが実行 |
| 履歴テーブル INSERT（評価結果保存） | Service Role | 評価サービスが実行 |
| 履歴テーブル SELECT（一覧・通知） | User Role（RLS） | `get_accessible_user_ids` で絞り込み |
| 設定テーブル SELECT（閾値表示等） | User Role（RLS） | `get_accessible_user_ids` で絞り込み |
| 履歴テーブル UPDATE（既読化） | SECURITY DEFINER 関数 | `is_read` のみ更新可能に固定 |

### 12.7 代表クエリ

```sql
-- 未読件数（通知用）
select count(*)
from public.google_ads_keyword_evaluation_history h
where h.user_id in (select get_accessible_user_ids(auth.uid()))
  and h.is_read = false
  and h.status = 'needs_improvement';

-- 一覧（キーワードごと最新1件）
select distinct on (h.customer_id, h.keyword_id)
  h.id,
  h.customer_id,
  h.keyword_id,
  h.keyword_text,
  h.status,
  h.triggered_rules,
  h.suggestions,
  h.cumulative_clicks,
  h.cumulative_conversions,
  h.daily_ctr,
  h.quality_score,
  h.is_read,
  h.evaluated_at,
  s.evaluation_start_date,
  s.ctr_threshold,
  s.cvr_threshold,
  s.cpa_threshold_yen,
  s.click_threshold
from public.google_ads_keyword_evaluation_history h
join public.google_ads_keyword_evaluation_settings s
  on s.user_id = h.user_id
  and s.customer_id = h.customer_id
  and s.keyword_id = h.keyword_id
where h.user_id in (select get_accessible_user_ids(auth.uid()))
order by h.customer_id, h.keyword_id, h.evaluated_at desc;

-- 未評価キーワードの取得（日次評価実行時）
select *
from public.google_ads_keyword_evaluation_settings
where user_id = :target_user_id
  and status = 'active'
  and (last_evaluated_on is null or last_evaluated_on < (now() at time zone 'Asia/Tokyo')::date);
```

## 13. 実装順序（推奨）

設計書承認後、以下の順序で段階的に実装する。

| Phase | 内容 | 依存 |
|-------|------|------|
| 1 | マイグレーション（設定テーブル + 履歴テーブル + RLS） | なし |
| 2 | 型定義の追加（`src/types/googleAds.types.ts`） | Phase 1 |
| 3 | 評価サービス（`googleAdsEvaluationService.ts`） | Phase 2 |
| 4 | Server Actions（評価実行 / 一覧 / 既読） | Phase 3 |
| 5 | 評価一覧画面（`app/google-ads-evaluations/page.tsx`） | Phase 4 |
| 6 | ダッシュボードからの導線追加 + 自動評価トリガー | Phase 5 |
| 7 | 通知ハンドラー（`GoogleAdsNotificationHandler`） | Phase 4 |

## 14. ビジネス要望（原文ベース）

> **注記**: 本節（14〜17節）は要望トレース用の補助セクションである。実装上の正式仕様は **2節（スコープ）・4節（評価ロジック）・11節（将来拡張）** を優先すること。

本機能は、以下の要望を満たすことを目的とする。

- クリック率（CTR）
  - 前日（将来的にはユーザーに期間を設定させたいが、初期はデフォルトで前日基準）の CTR が 5% を下回る場合は改善提案を出す。
- 平均クリック単価（CPC）
  - 評価・提案には使用しない（総合確認指標として表示のみ）。
- 品質スコア
  - 過去14日（将来的にはユーザーに期間を設定させたいが、初期はデフォルトで前日基準）の品質スコアをチェックし、同じ、または低下の場合に改善提案を出す。
  - 品質スコアが 10 の場合は最高評価のため提案不要。
- コンバージョン数
  - 評価開始から 50 クリックに到達してもコンバージョンが 0 の場合に改善提案を出す。
- コンバージョン単価（CPA）
  - 一定以上の場合に改善提案を出す（閾値は市場依存のため要相談）。
- 検索インプレッションシェア
  - 評価・提案には使用しない（総合確認指標として表示のみ）。
- コンバージョン率（CVR）
  - 評価開始から 50 クリックに到達し、CVR が 1% 以下の場合に改善提案を出す。
  - 基準値は市場/ユーザー依存のため、将来的にユーザー設定可能にする。

## 15. 初期リリースでの解釈（実装方針）

> **注記**: 本節は14節の要望に対する初期リリース時点の実装判断を記録する。正式な実装仕様は **4節（評価ロジック）** を参照すること。

- CTR: 前日値で判定（閾値 5%）。評価期間のユーザー設定化は将来拡張。
- CPC: 表示のみ（評価対象外）。
- 品質スコア: 初期はベースライン比較（前日取得値 vs 評価開始時記録値）で判定し、14日間トレンド比較は将来拡張で対応。
- コンバージョン数: 評価開始日以降の累積で判定（50クリック以上かつCV=0）。
- CPA: 初期は評価無効（`cpa_threshold_yen = null`）。ユーザー設定導入後に有効化。
- 検索インプレッションシェア: 表示のみ（評価対象外）。
- CVR: 評価開始日以降の累積で判定（50クリック以上かつCVR<=1%）。閾値のユーザー設定化は将来拡張。

## 16. 評価対象外指標（明示）

> **注記**: 正式な定義は **2節（スコープ）** を参照すること。

以下は評価提案ロジックには使用しない。

- 平均クリック単価（CPC）
- 検索インプレッションシェア

ただし、ダッシュボード上の参照指標としては保持・表示対象とする。

## 17. 将来拡張（要望起点）

> **注記**: 本節はビジネス要望を起点とした将来拡張項目である。設計・技術起点の拡張項目は **11節（将来拡張）** を参照すること。

要望との整合を保つため、以下を将来拡張として管理する。

- 品質スコア判定の14日比較モード（`quality_score_lookback_days = 14`）。
- CTR/CVR/CPA/クリック閾値のユーザー設定化。
- CTR評価期間・品質スコア比較期間のユーザー設定化（前日/7日/14日/30日）。
- 業種別テンプレートによる初期閾値の自動設定。
