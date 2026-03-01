# メールログイン（Magic Link）& LINE→Email アカウント移行 仕様書

**作成日**: 2026-03-01
**ステータス**: ドラフト

---

## 1. 目的・背景

### 1.1 目的

現行の LINE LIFF 認証に加え、メールアドレスによる Magic Link 認証を導入する。
また、既存の LINE アカウントユーザーが任意でメールアカウントへ移行できる機能を提供し、LINE に依存しないログイン手段を確立する。

### 1.2 背景

- LINE LIFF に依存した認証はモバイルブラウザ制約や LINE アプリ未導入環境で障壁となる
- B2B SaaS としてメールベースの認証は顧客の期待値に合致する
- 将来的なマルチドメイン（account_id）管理の前提基盤として、認証手段の柔軟化が必要

---

## 2. スコープ

### 対象

- **Phase 1**: Magic Link によるメールログイン機能
- **Phase 1.5**: 既存 LINE ユーザーからメールアカウントへのデータ移行機能（ユーザー任意）

### 非対象

- Phase 2 以降のマルチドメイン管理（`account_id` 導入）
- Phase 3: Stripe 廃止
- パスワード認証（Magic Link のみ）
- ソーシャルログイン（Google, GitHub 等）の追加
- LINE 認証の廃止（既存ユーザー向けに併存を維持）

---

## 3. 用語定義

| 用語 | 定義 |
|------|------|
| Magic Link | メールアドレスに送信される一回限りの認証リンク。クリックでログインが完了する |
| 認証プロバイダ (`auth_provider`) | ユーザーの認証手段を示す識別子。`line` または `email` |
| 移行元アカウント | LINE 認証で作成された既存ユーザーレコード |
| 移行先アカウント | Magic Link で作成された新規メールユーザーレコード |
| アカウント統合 | 移行元の全データを移行先に紐付け直し、移行元を無効化する操作 |

---

## 4. 前提条件

### 4.1 現行認証フロー

```
LINE アプリ
  → LINE OAuth 2.1（/api/auth/line-oauth-init）
  → LINE Callback（/api/line/callback）
  → アクセストークン + リフレッシュトークンを httpOnly Cookie に保存
  → authMiddleware が Cookie からトークンを取得・検証
  → UserService.getUserFromLiffToken() でユーザー取得/作成
```

### 4.2 現行 users テーブル

```sql
CREATE TABLE users (
  id                    UUID PRIMARY KEY,
  line_user_id          TEXT NOT NULL UNIQUE,
  line_display_name     TEXT NOT NULL,
  line_picture_url      TEXT,
  line_status_message   TEXT,
  stripe_customer_id    TEXT,
  stripe_subscription_id TEXT,
  role                  TEXT NOT NULL DEFAULT 'trial'
                        CHECK (role IN ('trial','paid','admin','unavailable','owner')),
  owner_user_id         UUID REFERENCES users(id),
  owner_previous_role   TEXT,
  full_name             TEXT,
  last_login_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL,
  updated_at            TIMESTAMPTZ NOT NULL
);
```

### 4.3 user_id を保持する全テーブル一覧（19テーブル）

| # | テーブル名 | カラム名 | 型 | FK | CASCADE |
|---|-----------|----------|-----|-----|---------|
| 1 | users | id (PK) | UUID | — | — |
| 2 | users | owner_user_id | UUID | YES | NO |
| 3 | chat_sessions | user_id | TEXT | NO | — |
| 4 | chat_messages | user_id | TEXT | NO | — |
| 5 | briefs | user_id | TEXT | NO | — |
| 6 | content_annotations | user_id | TEXT | NO | — |
| 7 | wordpress_settings | user_id | UUID | YES | CASCADE |
| 8 | gsc_credentials | user_id | UUID | YES | CASCADE |
| 9 | gsc_page_metrics | user_id | UUID | YES | CASCADE |
| 10 | gsc_article_evaluations | user_id | UUID | YES | CASCADE |
| 11 | gsc_article_evaluation_history | user_id | UUID | YES | CASCADE |
| 12 | gsc_query_metrics | user_id | UUID | YES | CASCADE |
| 13 | ga4_page_metrics_daily | user_id | UUID | YES | CASCADE |
| 14 | google_ads_credentials | user_id | UUID | YES | CASCADE |
| 15 | employee_invitations | owner_user_id | UUID | YES | CASCADE |
| 16 | employee_invitations | used_by_user_id | UUID | YES | NO |
| 17 | prompt_templates | created_by / updated_by | UUID | YES | SET NULL |
| 18 | prompt_versions | created_by | UUID | YES | SET NULL |
| 19 | session_heading_sections | (間接: session_id → chat_sessions) | — | — | CASCADE |
| 20 | session_combined_contents | (間接: session_id → chat_sessions) | — | — | CASCADE |

**注意**: TEXT 型 user_id（#3〜#6）は FK 制約がないため、移行時にアプリ層で整合性を保証する必要がある。

---

## 5. Phase 1: Magic Link 認証

### 5.1 DB変更: users テーブル拡張

```sql
-- マイグレーション: add_email_auth_to_users.sql

-- 1. email カラム追加
ALTER TABLE users ADD COLUMN email TEXT UNIQUE;

-- 2. 認証プロバイダ識別子
ALTER TABLE users ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'line'
  CHECK (auth_provider IN ('line', 'email'));

-- 3. line_user_id の NOT NULL 制約を解除（メールユーザーは LINE ID を持たない）
ALTER TABLE users ALTER COLUMN line_user_id DROP NOT NULL;

-- 4. line_display_name の NOT NULL 制約を解除
ALTER TABLE users ALTER COLUMN line_display_name DROP NOT NULL;

-- 5. 排他制約: line ユーザーは line_user_id 必須、email ユーザーは email 必須
ALTER TABLE users ADD CONSTRAINT users_auth_provider_check
  CHECK (
    (auth_provider = 'line' AND line_user_id IS NOT NULL) OR
    (auth_provider = 'email' AND email IS NOT NULL)
  );

-- 6. ロールバック
-- ALTER TABLE users DROP CONSTRAINT users_auth_provider_check;
-- ALTER TABLE users ALTER COLUMN line_display_name SET NOT NULL;
-- ALTER TABLE users ALTER COLUMN line_user_id SET NOT NULL;
-- ALTER TABLE users DROP COLUMN auth_provider;
-- ALTER TABLE users DROP COLUMN email;
```

**変更後の users テーブル（主要カラム）:**

```
users
├── id                    UUID PK
├── email                 TEXT UNIQUE (NULL: LINE ユーザー)
├── auth_provider         TEXT NOT NULL ('line' | 'email')
├── line_user_id          TEXT UNIQUE (NULL: メールユーザー)
├── line_display_name     TEXT (NULL: メールユーザー)
├── line_picture_url      TEXT
├── line_status_message   TEXT
├── stripe_customer_id    TEXT
├── stripe_subscription_id TEXT
├── role                  TEXT NOT NULL
├── owner_user_id         UUID FK
├── full_name             TEXT
├── last_login_at         TIMESTAMPTZ
├── created_at            TIMESTAMPTZ
└── updated_at            TIMESTAMPTZ
```

### 5.2 Magic Link 認証フロー

#### 5.2.1 ログイン（メール送信）

```
ユーザー: メールアドレスを入力して「ログインリンクを送信」をクリック

POST /api/auth/magic-link/send
  Body: { email: string }

サーバー処理:
  1. email バリデーション（Zod）
  2. 認証トークン生成（crypto.randomUUID()）
  3. magic_link_tokens テーブルに保存
     - token: TEXT UNIQUE
     - email: TEXT NOT NULL
     - expires_at: TIMESTAMPTZ (15分後)
     - used_at: TIMESTAMPTZ (NULL)
     - created_at: TIMESTAMPTZ
  4. Magic Link メール送信
     - URL: {SITE_URL}/api/auth/magic-link/verify?token={token}
  5. レスポンス: { success: true }
```

#### 5.2.2 トークン検証・ログイン完了

```
ユーザー: メール内のリンクをクリック

GET /api/auth/magic-link/verify?token={token}

サーバー処理:
  1. magic_link_tokens からトークン取得
  2. バリデーション:
     - トークンが存在する
     - used_at が NULL（未使用）
     - expires_at > now()（有効期限内）
  3. トークンを使用済みに更新（used_at = now()）
  4. users テーブルから email でユーザー検索
     a. 存在しない場合:
        - 新規ユーザー作成（auth_provider='email', role='trial'）
     b. 存在する場合:
        - last_login_at を更新
  5. セッショントークン生成・Cookie 設定
     - app_session_token: httpOnly Cookie (3日)
     - app_refresh_token: httpOnly Cookie (90日)
  6. リダイレクト: / (トップページ)
```

#### 5.2.3 セッション管理

```
新規テーブル: app_sessions

CREATE TABLE app_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token  TEXT NOT NULL UNIQUE,
  refresh_token  TEXT NOT NULL UNIQUE,
  expires_at     TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_sessions_user_id ON app_sessions(user_id);
CREATE INDEX idx_app_sessions_session_token ON app_sessions(session_token);
CREATE INDEX idx_app_sessions_expires_at ON app_sessions(expires_at);
```

**セッション有効期間:**

| トークン種別 | 有効期間 | Cookie 属性 |
|-------------|---------|------------|
| session_token | 3日 | httpOnly, Secure, SameSite=Lax |
| refresh_token | 90日 | httpOnly, Secure, SameSite=Lax |

**リフレッシュフロー:**

```
GET /api/auth/refresh

サーバー処理:
  1. Cookie から refresh_token を取得
  2. app_sessions から検索
  3. 有効期限チェック
  4. 新しい session_token / refresh_token を生成
  5. app_sessions を更新
  6. 新しい Cookie を設定
```

### 5.3 authMiddleware の二重対応

現行の `authMiddleware` は LINE トークンのみ対応。メール認証との共存のため以下を変更する。

```typescript
// 認証フロー分岐の擬似コード

export async function ensureAuthenticated(
  request: NextRequest
): Promise<AuthenticatedUser> {

  // 1. メール認証セッションをチェック（優先）
  const appSessionToken = getCookie('app_session_token');
  if (appSessionToken) {
    return authenticateBySession(appSessionToken);
  }

  // 2. LINE トークンをチェック（後方互換）
  const lineAccessToken = getCookie('line_access_token');
  const lineRefreshToken = getCookie('line_refresh_token');
  if (lineAccessToken || lineRefreshToken) {
    return authenticateByLine(lineAccessToken, lineRefreshToken);
  }

  // 3. 認証なし
  return { error: '認証が必要です' };
}

async function authenticateBySession(
  sessionToken: string
): Promise<AuthenticatedUser> {
  // app_sessions テーブルからユーザー取得
  // セッション有効期限チェック
  // ユーザー情報・ロール・サブスク状態を返却
  // 既存の viewMode / スタッフ関連ロジックはそのまま適用
}

async function authenticateByLine(
  accessToken: string | undefined,
  refreshToken: string | undefined
): Promise<AuthenticatedUser> {
  // 既存の LINE 認証フロー（変更なし）
}
```

**重要**: `AuthenticatedUser` の `lineUserId` フィールドはメールユーザーの場合 `null` となる。
下流で `lineUserId` を参照している箇所を洗い出し、`null` 安全にする必要がある。

#### 5.3.1 lineUserId 参照箇所の影響範囲

| ファイル | 用途 | 対応方針 |
|---------|------|---------|
| `auth.middleware.ts` | LINE プロフィール取得 | メールユーザーはスキップ |
| `userService.ts` | `getUserFromLiffToken()` | メール用の `getUserByEmail()` を新設 |
| `userService.ts` | `updateStripeCustomerId()` | `lineUserId` → `userId` ベースに変更 |
| `userService.ts` | `updateStripeSubscriptionId()` | 同上 |
| `supabaseService.ts` | `getUserByLineId()` | メールユーザーは `getUserByEmail()` を使用 |
| `login.actions.ts` | LINE プロフィール取得 | メールユーザーは別経路 |

### 5.4 ログイン UI

#### 5.4.1 画面構成

```
┌─────────────────────────────────────────┐
│                GrowMate                 │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  メールアドレスでログイン          │  │
│  │                                   │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │ email@example.com           │  │  │
│  │  └─────────────────────────────┘  │  │
│  │                                   │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │   ログインリンクを送信 ✉️    │  │  │
│  │  └─────────────────────────────┘  │  │
│  │                                   │  │
│  │  ─────── または ───────           │  │
│  │                                   │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │   LINEでログイン 💬          │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

#### 5.4.2 メール送信完了画面

```
┌─────────────────────────────────────────┐
│                GrowMate                 │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  ✉️ メールを送信しました          │  │
│  │                                   │  │
│  │  user@example.com に              │  │
│  │  ログインリンクを送信しました。    │  │
│  │                                   │  │
│  │  メール内のリンクをクリックして    │  │
│  │  ログインを完了してください。      │  │
│  │                                   │  │
│  │  ※ 15分以内に届かない場合は       │  │
│  │    再送信してください。            │  │
│  │                                   │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │      リンクを再送信          │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

#### 5.4.3 UI 遷移フロー

```
/login
  ├── メールアドレス入力 → POST /api/auth/magic-link/send → 送信完了画面
  │                                                          └── 再送信ボタン
  │
  └── LINE でログイン → /api/auth/line-oauth-init → LINE OAuth → /api/line/callback → /
```

### 5.5 メール送信基盤

#### 5.5.1 送信方法の選択

Supabase の組み込みメール機能（`supabase.auth.signInWithOtp`）は使用せず、独自にトークン管理とメール送信を行う。

理由:
- 既存の独自ユーザーテーブル（`public.users`）との整合性を維持するため
- Supabase Auth の `auth.users` との二重管理を避けるため
- LINE 認証との統合制御をアプリ層で一元管理するため

#### 5.5.2 メール送信サービス

外部メール送信サービスとして **Resend** を採用する（候補）。

```typescript
// src/server/services/emailService.ts

interface EmailService {
  sendMagicLink(email: string, token: string): Promise<void>;
}
```

### 5.6 環境変数追加

```env
# メール認証
EMAIL_PROVIDER=resend              # メール送信プロバイダ
RESEND_API_KEY=re_xxxxx            # Resend API キー
EMAIL_FROM=noreply@growmate.jp     # 送信元アドレス
```

`src/env.ts` にバリデーションを追加する。メール認証を無効化する場合は `EMAIL_PROVIDER` を未設定にする。

### 5.7 新規ファイル一覧

```
app/api/auth/magic-link/send/route.ts       # Magic Link 送信 API
app/api/auth/magic-link/verify/route.ts     # トークン検証・ログイン API
app/api/auth/refresh/route.ts               # セッションリフレッシュ（既存拡張）
app/login/page.tsx                          # ログインページ（既存改修）
src/server/services/emailService.ts         # メール送信サービス
src/server/services/sessionService.ts       # セッション管理サービス
supabase/migrations/XXXXXX_add_email_auth.sql
supabase/migrations/XXXXXX_create_magic_link_tokens.sql
supabase/migrations/XXXXXX_create_app_sessions.sql
```

---

## 6. Phase 1.5: LINE → Email アカウント移行

### 6.1 概要

既存の LINE アカウントユーザーが、メールアカウントへ全データを移行できるセルフサービス機能。
移行はユーザー任意であり、LINE ログインは移行後も他ユーザー向けに維持される。

### 6.2 移行パターン

#### パターン A: 新規メールアカウントへの統合（主要フロー）

```
前提: ユーザーは LINE アカウントでログイン済み

1. LINE ユーザー（UUID-A）が設定画面で「メールアカウントに切り替え」を選択
2. メールアドレスを入力
3. そのメールアドレスに Magic Link を送信（所有権確認）
4. Magic Link クリックで検証完了
5. 新規メールユーザー（UUID-B）を作成（auth_provider='email'）
6. UUID-A の全データを UUID-B に移行（migrate_user_data RPC）
7. UUID-A を無効化（role='unavailable', auth_provider そのまま）
8. UUID-B のセッションで自動ログイン
```

#### パターン B: 既存メールアカウントへの統合

```
前提: ユーザーが LINE と Email の両方のアカウントを既に持っている場合

1. LINE ユーザー（UUID-A）が設定画面で「メールアカウントに切り替え」を選択
2. メールアドレスを入力
3. 入力されたメールが既存ユーザー（UUID-B）に紐付いている場合
4. 確認ダイアログ: 「このメールアドレスには既にアカウントがあります。データを統合しますか？」
   ※ UUID-B 側に既存データがある場合、両者のデータが統合される
5. Magic Link で所有権確認
6. UUID-A の全データを UUID-B に移行（既存データとマージ）
7. UUID-A を無効化
8. UUID-B のセッションで自動ログイン
```

### 6.3 移行フロー詳細

#### 6.3.1 ステップ 1: 移行開始（設定画面）

```
アクセス条件:
  - LINE 認証でログイン中（auth_provider = 'line'）
  - role が 'unavailable' でない

表示場所: /settings または /account（新規ページ）
```

#### 6.3.2 ステップ 2: メールアドレス入力・検証

```
POST /api/auth/account-migration/initiate
  Headers: Cookie (LINE セッション)
  Body: { email: string }

サーバー処理:
  1. authMiddleware で LINE ユーザーを認証
  2. email バリデーション（Zod: メール形式 + 空文字チェック）
  3. 同一メールで既存ユーザーが存在するかチェック
     a. 存在する場合: パターン B フラグを立てる
     b. 存在しない場合: パターン A
  4. migration_tokens テーブルにレコード作成
     - token: crypto.randomUUID()
     - source_user_id: UUID-A (LINE ユーザー)
     - target_email: 入力されたメールアドレス
     - target_user_id: UUID-B (既存メールユーザー) or NULL
     - migration_type: 'new' | 'merge'
     - expires_at: now() + 30分
     - status: 'pending'
  5. Magic Link メール送信
     - URL: {SITE_URL}/api/auth/account-migration/verify?token={token}
  6. レスポンス:
     { success: true, migrationType: 'new' | 'merge' }
```

#### 6.3.3 ステップ 3: メール検証・移行確認

```
GET /api/auth/account-migration/verify?token={token}

サーバー処理:
  1. migration_tokens からトークン取得・検証
     - 存在確認、未使用確認、有効期限確認
  2. 確認画面にリダイレクト: /account-migration/confirm?token={token}
```

#### 6.3.4 ステップ 4: 移行実行

```
確認画面で「移行を実行」ボタンをクリック

POST /api/auth/account-migration/execute
  Body: { token: string }

サーバー処理:
  1. migration_tokens からトークン取得・再検証
  2. status を 'processing' に更新（二重実行防止）
  3. パターン A の場合:
     a. 新規メールユーザー（UUID-B）を作成
  4. migrate_user_data RPC を実行（後述 6.4）
  5. 移行元ユーザー（UUID-A）を無効化:
     - role = 'unavailable'
     - updated_at = now()
  6. migration_tokens.status を 'completed' に更新
  7. UUID-B のセッションを作成・Cookie 設定
  8. レスポンス: { success: true, redirectTo: '/' }

エラー時:
  - migration_tokens.status を 'failed' に更新
  - エラー詳細を migration_tokens.error_message に記録
  - ユーザーに再試行を案内
```

### 6.4 移行 RPC 関数: `migrate_user_data`

```sql
-- マイグレーション: add_migrate_user_data_rpc.sql

CREATE OR REPLACE FUNCTION migrate_user_data(
  p_source_user_id UUID,  -- 移行元（LINE ユーザー）
  p_target_user_id UUID   -- 移行先（メールユーザー）
)
RETURNS TABLE (
  migrated_tables TEXT,
  migrated_rows   INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_exists BOOLEAN;
  v_target_exists BOOLEAN;
  v_row_count     INT;
BEGIN
  -- ============================================
  -- バリデーション
  -- ============================================
  SELECT EXISTS(SELECT 1 FROM users WHERE id = p_source_user_id) INTO v_source_exists;
  SELECT EXISTS(SELECT 1 FROM users WHERE id = p_target_user_id) INTO v_target_exists;

  IF NOT v_source_exists THEN
    RAISE EXCEPTION '移行元ユーザーが存在しません: %', p_source_user_id;
  END IF;

  IF NOT v_target_exists THEN
    RAISE EXCEPTION '移行先ユーザーが存在しません: %', p_target_user_id;
  END IF;

  IF p_source_user_id = p_target_user_id THEN
    RAISE EXCEPTION '移行元と移行先が同一です';
  END IF;

  -- ============================================
  -- TEXT 型 user_id テーブル（FK 制約なし）
  -- ============================================

  -- 1. chat_sessions
  UPDATE chat_sessions
    SET user_id = p_target_user_id::TEXT
    WHERE user_id = p_source_user_id::TEXT;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  migrated_tables := 'chat_sessions';
  migrated_rows := v_row_count;
  RETURN NEXT;

  -- 2. chat_messages
  UPDATE chat_messages
    SET user_id = p_target_user_id::TEXT
    WHERE user_id = p_source_user_id::TEXT;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  migrated_tables := 'chat_messages';
  migrated_rows := v_row_count;
  RETURN NEXT;

  -- 3. briefs（UNIQUE 制約あり: user_id）
  --    移行先に既にデータがある場合はマージ不可 → 移行元を優先
  IF EXISTS (SELECT 1 FROM briefs WHERE user_id = p_target_user_id::TEXT) THEN
    -- 移行先に既存データがある場合: 移行元データを削除（移行先を優先）
    DELETE FROM briefs WHERE user_id = p_source_user_id::TEXT;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    migrated_tables := 'briefs (skipped: target exists)';
    migrated_rows := 0;
  ELSE
    UPDATE briefs
      SET user_id = p_target_user_id::TEXT
      WHERE user_id = p_source_user_id::TEXT;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    migrated_tables := 'briefs';
    migrated_rows := v_row_count;
  END IF;
  RETURN NEXT;

  -- 4. content_annotations（UNIQUE 制約: user_id, wp_post_id）
  --    移行先に同一 wp_post_id のデータが存在する場合は移行元を削除
  DELETE FROM content_annotations
    WHERE user_id = p_source_user_id::TEXT
      AND (user_id, wp_post_id) IN (
        SELECT p_source_user_id::TEXT, wp_post_id
        FROM content_annotations
        WHERE user_id = p_target_user_id::TEXT
      );

  UPDATE content_annotations
    SET user_id = p_target_user_id::TEXT
    WHERE user_id = p_source_user_id::TEXT;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  migrated_tables := 'content_annotations';
  migrated_rows := v_row_count;
  RETURN NEXT;

  -- ============================================
  -- UUID 型 user_id テーブル（FK CASCADE あり）
  -- ============================================

  -- 5. wordpress_settings（UNIQUE: user_id）
  IF EXISTS (SELECT 1 FROM wordpress_settings WHERE user_id = p_target_user_id) THEN
    DELETE FROM wordpress_settings WHERE user_id = p_source_user_id;
    migrated_tables := 'wordpress_settings (skipped: target exists)';
    migrated_rows := 0;
  ELSE
    UPDATE wordpress_settings
      SET user_id = p_target_user_id
      WHERE user_id = p_source_user_id;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    migrated_tables := 'wordpress_settings';
    migrated_rows := v_row_count;
  END IF;
  RETURN NEXT;

  -- 6. gsc_credentials（UNIQUE: user_id）
  IF EXISTS (SELECT 1 FROM gsc_credentials WHERE user_id = p_target_user_id) THEN
    DELETE FROM gsc_credentials WHERE user_id = p_source_user_id;
    migrated_tables := 'gsc_credentials (skipped: target exists)';
    migrated_rows := 0;
  ELSE
    UPDATE gsc_credentials
      SET user_id = p_target_user_id
      WHERE user_id = p_source_user_id;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    migrated_tables := 'gsc_credentials';
    migrated_rows := v_row_count;
  END IF;
  RETURN NEXT;

  -- 7. gsc_page_metrics
  UPDATE gsc_page_metrics
    SET user_id = p_target_user_id
    WHERE user_id = p_source_user_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  migrated_tables := 'gsc_page_metrics';
  migrated_rows := v_row_count;
  RETURN NEXT;

  -- 8. gsc_article_evaluations
  UPDATE gsc_article_evaluations
    SET user_id = p_target_user_id
    WHERE user_id = p_source_user_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  migrated_tables := 'gsc_article_evaluations';
  migrated_rows := v_row_count;
  RETURN NEXT;

  -- 9. gsc_article_evaluation_history
  UPDATE gsc_article_evaluation_history
    SET user_id = p_target_user_id
    WHERE user_id = p_source_user_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  migrated_tables := 'gsc_article_evaluation_history';
  migrated_rows := v_row_count;
  RETURN NEXT;

  -- 10. gsc_query_metrics
  UPDATE gsc_query_metrics
    SET user_id = p_target_user_id
    WHERE user_id = p_source_user_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  migrated_tables := 'gsc_query_metrics';
  migrated_rows := v_row_count;
  RETURN NEXT;

  -- 11. ga4_page_metrics_daily
  UPDATE ga4_page_metrics_daily
    SET user_id = p_target_user_id
    WHERE user_id = p_source_user_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  migrated_tables := 'ga4_page_metrics_daily';
  migrated_rows := v_row_count;
  RETURN NEXT;

  -- 12. google_ads_credentials（UNIQUE: user_id）
  IF EXISTS (SELECT 1 FROM google_ads_credentials WHERE user_id = p_target_user_id) THEN
    DELETE FROM google_ads_credentials WHERE user_id = p_source_user_id;
    migrated_tables := 'google_ads_credentials (skipped: target exists)';
    migrated_rows := 0;
  ELSE
    UPDATE google_ads_credentials
      SET user_id = p_target_user_id
      WHERE user_id = p_source_user_id;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    migrated_tables := 'google_ads_credentials';
    migrated_rows := v_row_count;
  END IF;
  RETURN NEXT;

  -- ============================================
  -- スタッフ・招待関連
  -- ============================================

  -- 13. employee_invitations: owner_user_id の付替え
  UPDATE employee_invitations
    SET owner_user_id = p_target_user_id
    WHERE owner_user_id = p_source_user_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  migrated_tables := 'employee_invitations (owner)';
  migrated_rows := v_row_count;
  RETURN NEXT;

  -- 14. employee_invitations: used_by_user_id の付替え
  UPDATE employee_invitations
    SET used_by_user_id = p_target_user_id
    WHERE used_by_user_id = p_source_user_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  migrated_tables := 'employee_invitations (used_by)';
  migrated_rows := v_row_count;
  RETURN NEXT;

  -- 15. users.owner_user_id: スタッフの親参照を付替え
  UPDATE users
    SET owner_user_id = p_target_user_id
    WHERE owner_user_id = p_source_user_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  migrated_tables := 'users (staff owner_user_id)';
  migrated_rows := v_row_count;
  RETURN NEXT;

  -- ============================================
  -- ロール・サブスク情報の引き継ぎ
  -- ============================================

  -- 16. 移行元のロール・Stripe情報を移行先に引き継ぐ
  UPDATE users
    SET
      role = (SELECT role FROM users WHERE id = p_source_user_id),
      stripe_customer_id = (SELECT stripe_customer_id FROM users WHERE id = p_source_user_id),
      stripe_subscription_id = (SELECT stripe_subscription_id FROM users WHERE id = p_source_user_id),
      owner_user_id = (SELECT owner_user_id FROM users WHERE id = p_source_user_id),
      owner_previous_role = (SELECT owner_previous_role FROM users WHERE id = p_source_user_id),
      updated_at = now()
    WHERE id = p_target_user_id;
  migrated_tables := 'users (role/stripe transfer)';
  migrated_rows := 1;
  RETURN NEXT;

  -- 17. 移行元を無効化
  UPDATE users
    SET
      role = 'unavailable',
      stripe_customer_id = NULL,
      stripe_subscription_id = NULL,
      owner_user_id = NULL,
      updated_at = now()
    WHERE id = p_source_user_id;
  migrated_tables := 'users (source deactivated)';
  migrated_rows := 1;
  RETURN NEXT;

  RETURN;
END;
$$;

-- ロールバック
-- DROP FUNCTION IF EXISTS migrate_user_data(UUID, UUID);
```

### 6.5 migration_tokens テーブル

```sql
CREATE TABLE migration_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token           TEXT NOT NULL UNIQUE,
  source_user_id  UUID NOT NULL REFERENCES users(id),
  target_email    TEXT NOT NULL,
  target_user_id  UUID REFERENCES users(id),  -- NULL: 新規作成パターン
  migration_type  TEXT NOT NULL CHECK (migration_type IN ('new', 'merge')),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message   TEXT,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_migration_tokens_token ON migration_tokens(token);
CREATE INDEX idx_migration_tokens_source ON migration_tokens(source_user_id);

-- 有効期限切れトークンの自動削除（30日後）
-- pg_cron または定期バッチで実行
```

### 6.6 移行 UI（ステップウィザード）

#### 6.6.1 Step 1: 移行案内

```
┌─────────────────────────────────────────────┐
│  アカウント設定                              │
│                                             │
│  現在の認証方法: LINE                        │
│  LINE ID: @user_display_name               │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  📧 メールアカウントに切り替える     │    │
│  │                                     │    │
│  │  メールアドレスでログインできるように │    │
│  │  アカウントを移行します。            │    │
│  │  すべてのデータは自動的に引き継がれ  │    │
│  │  ます。                             │    │
│  │                                     │    │
│  │  ⚠️ 移行後は LINE ログインは         │    │
│  │     使用できなくなります             │    │
│  │                                     │    │
│  │  ┌───────────────────────────────┐  │    │
│  │  │ メールアドレスを入力          │  │    │
│  │  └───────────────────────────────┘  │    │
│  │                                     │    │
│  │  [確認メールを送信]                  │    │
│  └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

#### 6.6.2 Step 2: メール送信完了

```
┌─────────────────────────────────────────────┐
│  アカウント移行                              │
│                                             │
│  ✉️ 確認メールを送信しました                 │
│                                             │
│  user@example.com に確認メールを             │
│  送信しました。                              │
│  メール内のリンクをクリックして               │
│  移行を続行してください。                    │
│                                             │
│  ※ 30分以内にリンクをクリックしてください    │
│                                             │
└─────────────────────────────────────────────┘
```

#### 6.6.3 Step 3: 移行確認（メールリンク先）

```
┌─────────────────────────────────────────────┐
│  アカウント移行の確認                        │
│                                             │
│  以下の内容でアカウントを移行します:          │
│                                             │
│  移行元: LINE (@user_display_name)          │
│  移行先: user@example.com                   │
│                                             │
│  移行されるデータ:                           │
│  ✓ チャット履歴                              │
│  ✓ 事業者情報                                │
│  ✓ WordPress 設定                            │
│  ✓ GSC/GA4 データ                            │
│  ✓ サブスクリプション情報                     │
│  ✓ スタッフ管理情報                           │
│                                             │
│  ⚠️ この操作は取り消せません。                │
│  移行後は LINE ログインが無効になります。      │
│                                             │
│  [キャンセル]        [移行を実行する]         │
│                                             │
└─────────────────────────────────────────────┘
```

#### 6.6.4 Step 4: 移行完了

```
┌─────────────────────────────────────────────┐
│  アカウント移行完了 ✅                       │
│                                             │
│  アカウントの移行が完了しました。             │
│                                             │
│  今後は user@example.com で                  │
│  ログインしてください。                       │
│                                             │
│  移行結果:                                   │
│  ・チャットセッション: 24件                   │
│  ・メッセージ: 156件                          │
│  ・アノテーション: 12件                       │
│  ・その他データ: すべて移行完了               │
│                                             │
│  [ダッシュボードへ]                           │
│                                             │
└─────────────────────────────────────────────┘
```

### 6.7 エッジケース

#### 6.7.1 スタッフがオーナーを移行する場合

```
状況: LINE ユーザー（UUID-A, role='paid', owner_user_id=UUID-X）がメールに移行

対応:
  1. migrate_user_data RPC 内で users.owner_user_id は変更しない
     （UUID-A → UUID-B に移行しても、owner_user_id=UUID-X のまま）
  2. ただし owner 側の get_accessible_user_ids は UUID-B を返す必要がある
  3. RPC 内で owner 側の参照が正しく UUID-B を指すよう更新済み（ステップ 15）
```

#### 6.7.2 オーナーがスタッフを持つ場合

```
状況: LINE ユーザー（UUID-A, role='owner'）がメールに移行。
      スタッフ（UUID-S, owner_user_id=UUID-A）が存在。

対応:
  1. スタッフの owner_user_id を UUID-A → UUID-B に更新（RPC ステップ 15）
  2. employee_invitations の owner_user_id も UUID-B に更新（RPC ステップ 13）
  3. 移行後もスタッフからオーナーへのアクセスが維持される
```

#### 6.7.3 Stripe サブスクリプションの付替え

```
状況: LINE ユーザー（UUID-A）が Stripe サブスクリプションを持つ

対応:
  1. RPC 内で stripe_customer_id / stripe_subscription_id を UUID-B に転記（ステップ 16）
  2. Stripe 側のメタデータ更新は不要
     （Stripe は customer_id で管理しており、アプリ側の user_id は参照しない）
  3. ただし stripe_customer_id でユーザー検索する箇所（webhook 等）が
     UUID-B を正しく返すことを確認する
```

#### 6.7.4 移行中のエラー・中断

```
対応方針:
  - RPC は単一トランザクションで実行されるため、途中エラーは自動ロールバック
  - migration_tokens.status = 'failed' に更新し、error_message に詳細を記録
  - ユーザーには「移行に失敗しました。データは変更されていません。」と表示
  - 再試行: 新しい migration_token を発行して再実行可能
```

#### 6.7.5 移行中の同時アクセス

```
対応方針:
  - migration_tokens.status = 'processing' をセマフォとして使用
  - 同一 source_user_id に対して status='processing' のレコードが存在する場合、新規移行を拒否
  - RPC 実行前に SELECT ... FOR UPDATE で移行元ユーザーをロック
```

#### 6.7.6 prompt_templates / prompt_versions の created_by

```
状況: 管理者（admin）が移行する場合、created_by に UUID-A が入っている可能性

対応:
  - prompt_templates.created_by / updated_by は ON DELETE SET NULL のため、
    移行元削除時に NULL になるが、移行ではなく無効化のため影響なし
  - 明示的に UUID-B への付替えは行わない（管理者の作成履歴として UUID-A を保持）
  - 理由: prompt_templates は共有リソースであり、作成者情報の書き換えは監査上望ましくない
```

### 6.8 移行 API 一覧

| メソッド | エンドポイント | 用途 |
|---------|---------------|------|
| POST | `/api/auth/account-migration/initiate` | 移行開始・確認メール送信 |
| GET | `/api/auth/account-migration/verify` | メールトークン検証 |
| POST | `/api/auth/account-migration/execute` | 移行実行 |
| GET | `/api/auth/account-migration/status` | 移行ステータス確認 |

### 6.9 新規ファイル一覧

```
app/api/auth/account-migration/initiate/route.ts
app/api/auth/account-migration/verify/route.ts
app/api/auth/account-migration/execute/route.ts
app/api/auth/account-migration/status/route.ts
app/account-migration/confirm/page.tsx
app/account-migration/complete/page.tsx
src/server/services/migrationService.ts
supabase/migrations/XXXXXX_create_migration_tokens.sql
supabase/migrations/XXXXXX_add_migrate_user_data_rpc.sql
```

---

## 7. セキュリティ考慮事項

### 7.1 メール認証

| 脅威 | 対策 |
|------|------|
| Magic Link の盗聴 | HTTPS 必須。トークンは1回限り使用。有効期限15分 |
| ブルートフォース | トークンは UUID v4（128bit エントロピー）。レート制限を実装 |
| メール列挙攻撃 | 存在/非存在に関わらず同一レスポンスを返す |
| セッションハイジャック | httpOnly + Secure + SameSite Cookie |
| CSRF | SameSite=Lax Cookie + Origin チェック |

### 7.2 アカウント移行

| 脅威 | 対策 |
|------|------|
| 他人のアカウントへの不正移行 | Magic Link でメール所有権を検証 |
| 二重移行 | migration_tokens.status による排他制御 |
| 移行中のデータ不整合 | 単一トランザクション + FOR UPDATE ロック |
| 移行後の旧アカウント悪用 | role='unavailable' に設定。LINE トークンでのログイン時にエラー表示 |
| 移行トークンの再利用 | used_at チェック + status 管理 |

### 7.3 レート制限

| エンドポイント | 制限 |
|---------------|------|
| Magic Link 送信 | 同一メール: 3回/15分 |
| 移行開始 | 同一ユーザー: 3回/1時間 |
| トークン検証 | 同一IP: 10回/15分 |

---

## 8. 工数見積もり

### Phase 1: Magic Link 認証 — 7-13日

| タスク | 工数 |
|--------|------|
| DB マイグレーション（users 拡張 + magic_link_tokens + app_sessions） | 1-2日 |
| メール送信サービス（Resend 連携） | 1-2日 |
| Magic Link 送信/検証 API | 1-2日 |
| セッション管理サービス | 1-2日 |
| authMiddleware の LINE/Email 二重対応 | 2-3日 |
| ログイン UI 改修 | 1-2日 |

### Phase 1.5: LINE→Email 移行 — 9-15日

| タスク | 工数 |
|--------|------|
| DB マイグレーション（migration_tokens + migrate_user_data RPC） | 2-3日 |
| アカウント紐付け検証フロー（API 4本） | 2-3日 |
| 移行 UI（ステップウィザード 4画面） | 2-3日 |
| migrationService 実装 | 1-2日 |
| エッジケース対応（スタッフ・Stripe 等） | 1-2日 |
| 検証（全テーブルのデータ移行確認 + RLS 動作確認） | 1-2日 |

### 合計: 16-28日

---

## 9. 実装順序

```
Phase 1 (Magic Link 認証)
  │
  ├── 1. DB マイグレーション（users 拡張）
  ├── 2. magic_link_tokens / app_sessions テーブル作成
  ├── 3. emailService 実装
  ├── 4. sessionService 実装
  ├── 5. Magic Link 送信/検証 API
  ├── 6. authMiddleware 二重対応
  └── 7. ログイン UI
  │
Phase 1.5 (LINE→Email 移行)
  │
  ├── 8. migration_tokens テーブル作成
  ├── 9. migrate_user_data RPC 実装
  ├── 10. migrationService 実装
  ├── 11. 移行 API（initiate / verify / execute / status）
  ├── 12. 移行 UI（4画面）
  ├── 13. エッジケース対応
  └── 14. 統合検証
```
