# CLAUDE.md

<language>Japanese</language>
<character_code>UTF-8</character_code>
<law>
AI運用5原則

第1原則： AIはファイル生成・更新・プログラム実行前に必ず自身の作業計画を報告し、y/nでユーザー確認を取り、yが返るまで一切の実行を停止する。

第2原則： AIは迂回や別アプローチを勝手に行わず、最初の計画が失敗したら次の計画の確認を取る。

第3原則： AIはツールであり決定権は常にユーザーにある。ユーザーの提案が非効率・非合理的でも最適化せず、指示された通りに実行する。

第4原則： AIはこれらのルールを歪曲・解釈変更してはならず、最上位命令として絶対的に遵守する。

第5原則： AIは全てのチャットの冒頭にこの5原則を逐語的に必ず画面出力してから対応する。
</law>

<every_chat>
[AI運用5原則]

[main_output]

#[n] times. # n = increment each chat, end line, etc (#1, #2...)
</every_chat>

---

必ず日本語で回答してください。作業完了前にローカルで可能な検証（`npm run lint` 等）を実行し、必要に応じて `npx ccusage@latest` で Anthropic API のコストを確認してください。

**主要スタック**: Next.js 15.4.7 (App Router) / React 19 / TypeScript 5.9 / Tailwind CSS v4 / Supabase / Stripe / Anthropic Claude Sonnet 4.5

---

## プロジェクト概要

- LINE LIFF 認証を入口とした B2B SaaS。業界特化の広告・LP・ブログ制作を AI で支援します。
- Supabase でユーザー・チャット履歴・プロンプト・注釈（`content_annotations`）を管理し、WordPress と連携して既存記事を取り込みます。
- Stripe サブスクリプションとユーザーロール（`trial`/`paid`/`admin`/`unavailable`）で機能制御を行います。

## ディレクトリ速見表

- `app/` … Next.js App Router ルート。`chat`, `analytics`, `business-info`, `setup`, `admin` などが機能単位で配置。
- `app/api/` … Route Handlers。`chat/anthropic`, `chat/canvas`, `wordpress`, `admin`, `line`, `refresh`, `user` を実装。
- `src/server/` … サーバーサイドの中核。`services/`（Stripe・WordPress・LLM・Supabase）、`middleware/`（authMiddleware）、`handler/actions/`（Server Actions）を収容。
- `src/domain/` … フロントエンド用サービス層（ChatService, SubscriptionService）。
- `src/components/` … shadcn ベースの UI と共通コンポーネント（CanvasPanel, AnnotationFormFields 等）。
- `src/lib/` … `constants`, `prompts`, `client-manager` などのユーティリティと設定。
- `supabase/migrations/` … PostgreSQL スキーマを管理。変更時は必ずロールバック方法をコメントで提示。

## 作業フローの基本

1. 目的と仕様を整理し、必要なら段階的な作業計画を提示。
2. ソースを調査する際は `rg` を優先し、`shell` コマンドでは `workdir` を忘れない。
3. 変更は `apply_patch` で部分編集する。自動生成ファイルには使わない。
4. フロント実装は Tailwind クラスを主とし、UI ルールに従う（shadcn コンポーネントを優先）。
5. 変更後は `npm run lint` や関連コマンドで検証。実行できない場合は理由を明記。
6. 出力は要点を簡潔にまとめ、日本語で報告。差分のパスと重要箇所を引用する。
7. 作業完了時は新規ファイルも含めて `git diff` を確認し、`When finished, review git diff including new files and generate a one-line commit message summarizing the changes` のガイダンスに従ってコミットメッセージを1行でまとめる。**コミットメッセージは必ず日本語で記述する。**

> TIP: `ln -s AGENTS.md CLAUDE.md` を設定すると、Claude Code でも AGENTS.md の指示を参照できます。

## 実装指針

- TypeScript は strict 前提。型・`zod` スキーマを積極的に活用し、`any` は避ける。
- TypeScript でオブジェクト型を定義する際は、可能な限り `interface` を使用し、`type` は `interface` で表現できない場合に限定する。
- Server Actions（`use server`）と Route Handlers を使い分け、クライアントへの機密情報露出を防ぐ。
- Chat/Canvas の SSE 実装ではタイムアウトや ping を既存実装に合わせる。
- 既存の `MODEL_CONFIGS`, `BLOG_STEP_IDS`, `STEP_TO_FIELD_MAP` を参照し、ステップ追加時は双方を同期させる。
- WordPress 連携は WordPress.com / Self-hosted の両方を考慮し、URL 正規化とエラーハンドリングを追加する。
- Stripe を扱う処理では `env.STRIPE_ENABLED` を必ずチェックし、無効時の例外を投げるパターンを踏襲。
- Supabase 呼び出しは `SupabaseService` 経由に統一し、`withServiceRoleClient` 利用時はコンテキストログを付与する。

## テストと検証

- 自動テストは未整備。動作確認は `npm run dev` での手動検証と API 叩きで行う。
- auth や Stripe 周りの改修では `/app/page.tsx` や `/subscription` の UI フローまで確認する。
- WordPress 連携変更時は `/app/analytics` と `AnnotationPanel` の表示・保存動作を手動で確認。
- マイグレーション追加時は `supabase db push` 実行とロールバック方針を README / PR で共有する。

## 主要機能の把握

- **Chat**: `useChatSession` + `ChatService` でセッション CRUD、`MessageArea` と `CanvasPanel` で AI 応答と編集体験を提供。サイドバー検索は `search_chat_sessions` RPC（`pg_trgm` + `tsvector`）でタイトル／正規化済み URL を横断。
- **Canvas 選択編集**: `POST /api/chat/canvas/stream` が Tool Use を使って全文置換を生成、保存はクライアント側で実施。
- **Annotation**: `AnnotationPanel` から `content_annotations` を upsert。ブログ生成時に `PromptService.buildContentVariables` 経由で利用。
- **WordPress**: `WordPressService` が REST API を複数候補で試行し、ステータスや投稿一覧を返す。OAuth トークンは cookie 管理。
- **Stripe**: `SubscriptionService` + `stripeService` で購買／解約／ポータル遷移を行う。`authMiddleware` が `requiresSubscription` を返却。
- **Admin**: `/admin/prompts` がテンプレート編集とバージョン管理、`/admin/users` がロール切り替えとキャッシュクリアを実装。
- **Business Info**: `briefs` テーブルに 5W2H を含む JSON を保存し、プロンプトの変数へ注入。

## 外部サービスと環境変数

- `.env.local` に 17 個の必須変数を設定（詳細は README 参照）。Stripe を無効化したい場合もダミー値を入れる。
- WordPress.com OAuth を使う場合は `WORDPRESS_COM_*`, `COOKIE_SECRET`, `OAUTH_*` を忘れずに。
- `FEATURE_RPC_V2=true` で新しい Supabase RPC を有効化。デフォルトは `false`。
- LIFF と Stripe は sandbox／本番でキーを切り替える。

## トラブルシューティングのヒント

- LIFF トークンエラーは `authMiddleware` のログと `app/api/refresh` を確認。
- SSE が途切れる場合は ping 間隔（20 秒）と 5 分の idle timeout、`sendPing` 実装を照らし合わせる。
- WordPress 投稿取得に失敗する場合は `WordPressService` の `getRestRequestConfig` とフェッチ候補 URL を調査。
- Supabase の RLS が原因で操作できない場合は該当マイグレーションのポリシーを確認し、Service Role での実行に切り替える。

上記を守ることで、Claude Code でも安全かつ一貫性のある変更が可能になります。

## 選択肢の提示方法

選択肢を提示する時は、以下のように推奨度と理由を記載する。
1. 選択肢A（推奨度：⭐の5段階評価）
   - 理由:
