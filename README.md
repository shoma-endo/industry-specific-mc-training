# Industry-Specific MC Training Platform

LINE LIFF を入り口に、業界特化のマーケティングコンテンツを一括生成・管理する SaaS アプリケーションです。Next.js 15 App Router を基盤に、マルチベンダー AI、WordPress 連携、Stripe サブスクリプション、Supabase による堅牢なデータ管理を統合しています。

## 🧭 プロダクト概要
- LIFF でログインしたユーザー向けに、広告／LP／ブログ制作を支援する AI ワークスペースを提供
- Anthropic Claude Sonnet 4.5 と OpenAI の Fine-tuned モデル `ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2` を用途に応じて切り替え
- WordPress.com / 自社ホスティングを問わない投稿取得と、Supabase へのコンテンツ注釈保存
- Stripe を用いた有料プラン管理と、ロール／サブスクリプション連動による機能制御
- 管理者向けのプロンプトテンプレート編集・ユーザー権限管理 UI を内蔵

## 🚀 主な機能

### LINE LIFF 認証とユーザー管理
- LIFF v2.25 を利用したシームレスな LINE ログインと自動トークンリフレッシュ
- サーバーサイドの `authMiddleware` でアクセストークン検証・ロール判定を一元管理
- Supabase `users` テーブルにプロフィール・サブスクリプション ID・ロール・最終ログインを保存

### AI コンテンツ支援ワークスペース
- `app/chat` 配下の ChatLayout で、セッション管理・モデル選択・AI 応答ストリーミングを統合
- `MODEL_CONFIGS` に定義した 7 ステップのブログ作成フロー（ニーズ整理〜本文作成）と広告／LP テンプレートを提供
- `POST /api/chat/anthropic/stream` による SSE で Claude 応答をリアルタイム描画
- セッションサイドバーに検索バーを追加し、`search_chat_sessions` RPC（全文検索 + `pg_trgm` 類似検索）でタイトルや正規化済み WordPress URL を横断検索
- ステップ毎のプロンプト変数へ `content_annotations` と 事業者ブリーフ (`briefs`) をマージし、文脈の再利用を最小化

### キャンバス編集と選択範囲リライト
- TipTap 3 ベースの `CanvasPanel` に Markdown レンダリング／見出しアウトライン／バージョン履歴を実装
- `POST /api/chat/canvas/stream` で選択範囲と指示を送信し、Claude の Tool Use による全文差し替えを適用
- 選択テキストの履歴・プレビュー・Web 検索トリガー（Claude ツール `web_search_20250305`）をサポート

### WordPress 連携とコンテンツ注釈
- WordPress.com OAuth とセルフホスト版 Application Password の両対応（`app/setup/wordpress`）
- `WordPressService` が REST API の候補 URL を試行し、投稿情報を正規化
- `app/analytics` の一覧で投稿と Supabase `content_annotations` を突き合わせ、未紐付けの注釈も表示
- `AnnotationPanel` でセッション単位のメモ・キーワード・ペルソナ・PREP 等を保存し、ブログ生成時に再利用

### Google Search Console 連携
- `/setup/gsc` で OAuth 認証状態・接続アカウント・プロパティを可視化し、プロパティ選択や連携解除を実行
- `app/api/gsc/oauth/*` が Google OAuth 2.0 の開始／コールバックに対応し、Supabase `gsc_credentials` テーブルへリフレッシュトークンを保存
- `/api/gsc/status`, `/api/gsc/properties`, `/api/gsc/property`, `/api/gsc/disconnect` で連携状態の確認・プロパティ取得・選択更新・接続解除を提供
- 取得した Search Console 指標は今後 WordPress 投稿の分析ビューと統合される予定（`SetupDashboard` から進入）

### サブスクリプションと権限
- Stripe v17.7 で Checkout / Billing Portal / Subscription 状態確認を実装（`SubscriptionService`）
- `SubscriptionService` とカスタムフック `useSubscriptionStatus` で UI 側から有効プランを判定
- `authMiddleware` が `requiresSubscription` を返し、有料機能へアクセス制御を適用
- ユーザー権限（`trial` / `paid` / `admin` / `unavailable`）を Supabase 側で管理し、LIFF ログイン時に自動同期（`trial` はチャット送信が1日3回まで、`paid` は無制限）

### 管理者ダッシュボード
- `/admin` でプロンプトテンプレート、ユーザー情報の管理 UI を提供
- `/admin/prompts` からテンプレート編集とバージョン保存、暗黙パラメータ（content 系変数）説明を表示
- `/admin/users` ではロール切り替え後に `POST /api/auth/clear-cache` を呼び出し、キャッシュを即時無効化

### 事業者情報ブリーフ
- `/business-info` でサービス概要や 5W2H、決済方法などを入力し、`briefs` テーブルに JSON として保存
- ブリーフはプロンプトテンプレートの変数へ流用され、広告文や LP のコンテキストを自動補完

### セットアップ導線
- `/setup/wordpress` で WordPress 連携の初期設定を案内
- `/setup/gsc` で Google Search Console OAuth 連携とプロパティ選択を管理
- `/subscription` でプラン購入、`/analytics` で WordPress 投稿と注釈を照合

## 🏗️ システムアーキテクチャ

```mermaid
graph TB
  subgraph Client["Next.js 15 (App Router)"]
    LIFFProvider["LIFF Provider & Auth Hooks"]
    ChatUI["Chat Layout / Session Sidebar"]
    Canvas["CanvasPanel (TipTap)"]
    Annotation["AnnotationPanel"]
    Analytics["Analytics Table"]
    BusinessForm["Business Info Form"]
    AdminUI["Admin Dashboards"]
  end

  subgraph Server["Next.js Route Handlers & Server Actions"]
    AuthMiddleware["authMiddleware"]
    ChatStream["/api/chat/anthropic/stream"]
    CanvasStream["/api/chat/canvas/stream"]
    WordPressAPI["/api/wordpress/*"]
    AdminAPI["/api/admin/*"]
    SubscriptionAPI["/api/refresh, /api/user/*"]
    ServerActions["server/handler/actions/*"]
  end

  subgraph Data["Supabase PostgreSQL"]
    UsersTable["users"]
    SessionsTable["chat_sessions"]
    MessagesTable["chat_messages"]
    BriefsTable["briefs"]
    AnnotationsTable["content_annotations"]
    PromptsTable["prompt_templates"]
    VersionsTable["prompt_versions"]
    WordpressTable["wordpress_settings"]
  end

  subgraph External["External Services"]
    LINE["LINE Platform (LIFF / Verify)"]
    Anthropic["Anthropic Claude"]
    OpenAI["OpenAI GPT-4.1 nano FT"]
    Stripe["Stripe Subscriptions"]
    WordPress["WordPress REST API"]
  end

  LIFFProvider --> AuthMiddleware
  ChatUI --> ChatStream
  Canvas --> CanvasStream
  Annotation --> ServerActions
  Analytics --> WordPressAPI
  BusinessForm --> ServerActions
  AdminUI --> AdminAPI

  ServerActions --> UsersTable
  ServerActions --> BriefsTable
  ServerActions --> AnnotationsTable
  ChatStream --> MessagesTable
  ChatStream --> SessionsTable
  WordPressAPI --> WordpressTable
  AdminAPI --> PromptsTable
  AdminAPI --> VersionsTable

  AuthMiddleware --> LINE
  ChatStream --> Anthropic
  CanvasStream --> Anthropic
  ChatStream --> OpenAI
  SubscriptionAPI --> Stripe
  WordPressAPI --> WordPress
```

## 🔄 認証フロー

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client (LIFF)
    participant L as LINE Platform
    participant S as Next.js Server
    participant DB as Supabase

    U->>C: アプリへアクセス
    C->>L: LIFF 初期化
    alt 未ログイン
        C->>L: LINE Login リクエスト
        L->>U: 認証画面を表示
        U->>L: 認証許可
        L->>C: アクセストークン付与
    end
    C->>S: アクセストークン検証
    S->>L: Verify API 照会
    L->>S: ユーザー情報を返却
    S->>DB: users テーブルを upsert / last_login_at 更新
    opt 管理者 or サブスクリプション確認
        S->>DB: role / subscription state を参照
    end
    S->>C: 認証済みセッションを返却
```

## 🛠️ 技術スタック
- **フロントエンド**: Next.js 15.4.7 (App Router), React 19, TypeScript 5.9, Tailwind CSS v4, Radix UI, shadcn/ui, lucide-react
- **エディタ**: TipTap 3.7.x + lowlight ハイライト、カスタム UI コンポーネント群
- **バックエンド**: Next.js Route Handlers & Server Actions, Supabase JS 2.75 (PostgreSQL + RLS)
- **AI**: Anthropic Claude Sonnet 4.5（SSE ストリーミング）, OpenAI Chat Completions（Fine-tuned モデル含む）
- **認証**: LINE LIFF 2.25.1, Vercel Edge Cookie ストア, 独自ミドルウェアによるロール判定
- **決済**: Stripe 17.7（Checkout / Billing Portal / Subscription API）
- **開発ツール**: TypeScript strict, ESLint 9, Prettier 3, tsc-watch, Husky, ngrok

## 📊 データベーススキーマ（主要テーブル）

```mermaid
erDiagram
    users {
        uuid id PK
        text line_user_id UK
        text line_display_name
        text line_picture_url
        text line_status_message
        text full_name
        text role
        text stripe_customer_id
        text stripe_subscription_id
        bigint last_login_at
        bigint created_at
        bigint updated_at
    }

    chat_sessions {
        text id PK
        text user_id FK
        text title
        text system_prompt
        bigint last_message_at
        bigint created_at
    }

    chat_messages {
        text id PK
        text user_id FK
        text session_id FK
        text role
        text content
        text model
        bigint created_at
    }

    briefs {
        uuid id PK
        text user_id UK
        jsonb data
        bigint created_at
        bigint updated_at
    }

    content_annotations {
        uuid id PK
        text user_id FK
        bigint wp_post_id
        text session_id
        text canonical_url
        text wp_post_title
        text main_kw
        text kw
        text impressions
        text persona
        text needs
        text goal
        text prep
        text basic_structure
        text opening_proposal
        timestamptz updated_at
    }

    wordpress_settings {
        uuid id PK
        uuid user_id FK
        text wp_type
        text wp_client_id
        text wp_client_secret
        text wp_site_id
        text wp_site_url
        text wp_username
        text wp_application_password
        timestamptz created_at
        timestamptz updated_at
    }

    prompt_templates {
        uuid id PK
        text name UK
        text display_name
        text content
        jsonb variables
        timestamptz created_at
        timestamptz updated_at
    }

    prompt_versions {
        uuid id PK
        uuid template_id FK
        integer version
        text content
        timestamptz created_at
    }

    users ||--o{ chat_sessions : owns
    chat_sessions ||--o{ chat_messages : contains
    users ||--|| briefs : "stores one brief"
    users ||--o{ content_annotations : annotates
    users ||--o| wordpress_settings : configures
    prompt_templates ||--o{ prompt_versions : captures
```

## 📋 環境変数（19 項目）

`src/env.ts` で厳格にバリデーションされるサーバー／クライアント環境変数です。`.env.local` を手動で用意してください。

| 種別 | 変数名 | 必須 | 用途 |
| ---- | ------ | ---- | ---- |
| Server | `DBPASS` | ✅ | Supabase からアクセスされる Postgres password |
| Server | `SUPABASE_SERVICE_ROLE` | ✅ | サーバーサイド特権操作用 Service Role キー |
| Server | `STRIPE_ENABLED` | 任意 | Stripe 機能の有効化フラグ（`true` / `false`） |
| Server | `STRIPE_SECRET_KEY` | ✅（Stripe 無効でもダミー値必須） | Stripe API 呼び出し用シークレット |
| Server | `STRIPE_PRICE_ID` | ✅（Stripe 無効でもダミー値必須） | サブスクリプションで使用する Price ID |
| Server | `OPENAI_API_KEY` | ✅ | Fine-tuned モデル利用時の OpenAI キー |
| Server | `ANTHROPIC_API_KEY` | ✅ | Claude ストリーミング用 API キー |
| Server | `LINE_CHANNEL_ID` | ✅ | LINE Login 用チャネル ID |
| Server | `LINE_CHANNEL_SECRET` | ✅ | LINE Login 用チャネルシークレット |
| Server | `GOOGLE_OAUTH_CLIENT_ID` | 任意（GSC 連携利用時は必須） | Google Search Console OAuth 用クライアント ID |
| Server | `GOOGLE_OAUTH_CLIENT_SECRET` | 任意（GSC 連携利用時は必須） | Google Search Console OAuth 用クライアントシークレット |
| Server | `GOOGLE_SEARCH_CONSOLE_REDIRECT_URI` | 任意（GSC 連携利用時は必須） | Google OAuth のリダイレクト先（`https://<host>/api/gsc/oauth/callback` など） |
| Server | `GSC_OAUTH_STATE_COOKIE_NAME` | 任意 | GSC OAuth state 用 Cookie 名（未設定時は `gsc_oauth_state`） |
| Client | `NEXT_PUBLIC_LIFF_ID` | ✅ | LIFF アプリ ID |
| Client | `NEXT_PUBLIC_LIFF_CHANNEL_ID` | ✅ | LIFF Channel ID |
| Client | `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase プロジェクト URL |
| Client | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon キー |
| Client | `NEXT_PUBLIC_SITE_URL` | ✅ | サイトの公開 URL |
| Client | `NEXT_PUBLIC_STRIPE_ENABLED` | 任意 | クライアント側での Stripe 有効化フラグ（未設定時は `STRIPE_ENABLED` を継承） |

### 追加で利用できる任意設定
- `WORDPRESS_COM_CLIENT_ID`, `WORDPRESS_COM_CLIENT_SECRET`, `WORDPRESS_COM_REDIRECT_URI`: WordPress.com OAuth 連携で必須
- `OAUTH_STATE_COOKIE_NAME`, `OAUTH_TOKEN_COOKIE_NAME`, `COOKIE_SECRET`: WordPress / Google Search Console OAuth のセキュアな Cookie 管理
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_SEARCH_CONSOLE_REDIRECT_URI`: Google Search Console 連携を利用する場合のみ設定
- `FEATURE_RPC_V2`: `true` で新しい Supabase RPC 経路を有効化（`FEATURE_FLAGS.USE_RPC_V2`）

## 🚀 セットアップ手順

### 必要条件
- Node.js 18 以上
- npm
- Supabase プロジェクト（Service Role キー取得済み）
- LINE Developers アカウント（LIFF & Login 設定）
- Stripe アカウント（サブスクリプション利用時）

### クイックスタート

```bash
git clone <repository-url>
cd industry-specific-mc-training
npm install
# .env.local に上記環境変数を設定
npx supabase db push       # マイグレーション適用
npm run dev                # tsc-watch + next dev --turbopack
# LIFF 実機確認が必要な場合は別ターミナルで
npm run ngrok
```

### ローカル開発のポイント
- `npm run lint` で ESLint + Next/Tailwind ルールを検証（Husky pre-commit でも実行）
- `npm run build` → `npm run start` で本番ビルドの健全性をチェック
- Supabase への変更は `supabase/migrations/` に SQL を追加し、ロールバック手順をコメントに残す
- LIFF 連携の動作確認は ngrok などで https 公開した上で LINE Developers のコールバック URL を更新

## 📁 プロジェクト構成

```
├── app/
│   ├── chat/                # AI チャットワークスペース（Canvas / Annotation / Step UI）
│   ├── analytics/           # WordPress 投稿 + 注釈ダッシュボード
│   ├── business-info/       # 事業者情報フォーム（Server Components + Actions）
│   ├── setup/               # WordPress / GSC 等の初期セットアップ導線
│   ├── subscription/        # サブスクリプション購入ページ
│   ├── login/               # ログインページ
│   ├── unauthorized/        # 未認可ユーザー向けページ
│   ├── unavailable/         # 利用不可ユーザー向けページ（role が unavailable の場合）
│   ├── wordpress-import/    # WordPress 記事の一括インポートページ
│   ├── admin/               # 管理者向け機能（プロンプト・ユーザー管理）
│   ├── api/                 # Route Handlers（chat, wordpress, admin, auth, user, line）
│   └── layout.tsx など      # App Router ルートレイアウト
├── src/
│   ├── components/          # 再利用可能な UI（shadcn/ui, AnnotationFormFields 等）
│   ├── domain/              # フロント向けサービス層（ChatService / SubscriptionService）
│   ├── hooks/               # LIFF / サブスクリプション / UI ユーティリティ
│   ├── lib/                 # 定数・プロンプト管理・Supabase クライアント生成
│   ├── server/
│   │   ├── handler/actions/ # Server Actions 経由のビジネスロジック
│   │   ├── middleware/      # 認証・ロール判定ミドルウェア
│   │   └── services/        # Stripe / WordPress / Supabase / LLM などの統合層
│   └── types/               # 共通型定義（chat, prompt, annotation, wordpress 等）
├── scripts/                 # ユーティリティスクリプト（DB 統計・Vercel 統計）
├── claudedocs/              # プロジェクト分析レポート
├── supabase/migrations/     # データベースマイグレーション
└── config files             # eslint.config.mjs, next.config.ts, tailwind/postcss 設定
```

## 🔧 主な API エンドポイント

| エンドポイント | メソッド | 概要 | 認証 |
| -------------- | -------- | ---- | ---- |
| `/api/chat/anthropic/stream` | POST | Claude とのチャット SSE ストリーム | `Authorization: Bearer <LIFF>` |
| `/api/chat/canvas/stream` | POST | Canvas 編集リクエスト（選択範囲差し替え） | `Authorization: Bearer <LIFF>` |
| `/api/chat/canvas/load-wordpress` | POST | WordPress記事をCanvasに読み込み | `Authorization: Bearer <LIFF>` |
| `/api/refresh` | POST | LINE リフレッシュトークンからアクセストークン再発行 | Cookie (`line_refresh_token`) |
| `/api/user/current` | GET | ログインユーザーのプロファイル・ロール情報 | Cookie (`line_access_token`) |
| `/api/auth/check-role` | GET | ロールのサーバー検証 | Cookie |
| `/api/auth/clear-cache` | POST | Edge キャッシュクリア通知 | 任意 |
| `/api/auth/line-oauth-init` | GET | LINE OAuth state生成エンドポイント | Cookie |
| `/api/line/callback` | GET | LINE OAuth コールバック | 公開（state チェックあり） |
| `/api/wordpress/settings` | GET/POST | WordPress 設定の取得・保存（server action と共有） | Cookie |
| `/api/wordpress/status` | GET | WordPress 接続状況の確認 | Cookie |
| `/api/wordpress/posts` | GET | WordPress 投稿一覧の取得 | Cookie + WP 認証 |
| `/api/wordpress/test-connection` | POST | WordPress 接続テスト | Cookie |
| `/api/wordpress/oauth/start` | GET | WordPress.com OAuth リダイレクト開始 | 公開（環境変数必須） |
| `/api/wordpress/oauth/callback` | GET | WordPress.com OAuth コールバック | Cookie |
| `/api/admin/prompts` | GET | プロンプトテンプレート一覧（管理者専用） | Cookie + admin ロール |
| `/api/admin/prompts/[id]` | POST | テンプレート更新・バージョン生成 | Cookie + admin ロール |
| `/api/wordpress/bulk-import-posts` | POST | WordPress 記事の一括インポート | Bearer + admin ロール |

サーバーアクション (`src/server/handler/actions/*`) では、ブリーフ保存・WordPress 投稿取得・注釈 upsert・Stripe セッション作成などを型安全に処理しています。

## 🛡️ セキュリティと運用の注意点
- Supabase では主要テーブルに RLS を適用済み（開発ポリシーが残る箇所は運用前に見直す）
- `authMiddleware` がロール・サブスクリプションを検証し、`requiresSubscription` でプレミアム機能を保護
- WordPress アプリケーションパスワードや OAuth トークンは HTTP-only Cookie に保存（本番では安全な KMS / Secrets 管理を推奨）
- SSE は 20 秒ごとの ping と 5 分アイドルタイムアウトで接続維持を調整
- `AnnotationPanel` の URL 正規化で内部／ローカルホストへの誤登録を防止

## 📱 デプロイと運用
- Vercel を想定（Edge Runtime と Node.js Runtime をルートごとに切り分け）
- デプロイ前チェック: `npm run lint` → `npm run build`
- 環境変数は Vercel Project Settings へ反映し、本番は Stripe 本番キー・WordPress 本番サイトに切り替え
- Supabase マイグレーションは `npx supabase db push` で同期、ロールバック手順（コメント）を常に更新

### GitHub Actions シークレット設定
週次レポート用のワークフローで使用するシークレットを GitHub Repository Settings → Secrets and variables → Actions で設定してください。

| シークレット名 | 用途 | 必須 |
| ------------- | ---- | ---- |
| `CI_WEBHOOK_URL` | CI ビルド結果通知用 Lark Webhook URL | 任意 |
| `DB_STATS_WEBHOOK_URL` | データベース統計レポート用 Lark Webhook URL | 任意 |
| `VERCEL_STATS_WEBHOOK_URL` | Vercel 統計レポート用 Lark Webhook URL | 任意 |
| `VERCEL_TOKEN` | Vercel API アクセストークン（Settings → Tokens で作成） | Vercel レポート用 |
| `VERCEL_PROJECT_ID` | Vercel プロジェクト ID（`prj_` で始まる） | Vercel レポート用 |
| `VERCEL_TEAM_ID` | Vercel チーム ID（`team_` で始まる、オプション） | Vercel レポート用（オプション） |

**Vercel API トークンの取得方法:**
1. Vercel Dashboard → Settings → Tokens
2. 「Create Token」をクリック
3. トークン名を入力し、スコープを設定（`Full Account` または `Project` スコープ）
4. 生成されたトークンを `VERCEL_TOKEN` シークレットに設定

**Vercel プロジェクト ID の取得方法:**
- Vercel Dashboard → プロジェクト → Settings → General の「Project ID」を確認
- または、`.vercel/project.json` ファイルの `projectId` フィールドを確認

## 🤝 コントリビューション
1. フィーチャーブランチを作成
2. 変更を実装し、`npm run lint` の結果を確認
3. 必要に応じて Supabase マイグレーションを追加し、ロールバック手順を明記
4. 変更内容を簡潔にまとめた PR を作成（ユーザー影響・環境変数・スクリーンショットを添付）

## 📄 ライセンス

このリポジトリは私的利用目的で運用されています。再配布や商用利用は事前相談のうえでお願いいたします。
