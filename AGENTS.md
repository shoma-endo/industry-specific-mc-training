# Repository Guidelines

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

## プロジェクト概要

- LINE LIFF 認証を入り口に、業界特化のマーケティングコンテンツ（広告・LP・ブログ等）を AI で生成・管理する Next.js 15 ベースの SaaS。
- Supabase がユーザー・セッション・注釈・プロンプトなどのデータを保持し、WordPress 連携で既存記事を取り込みます。
- Stripe サブスクリプションとロール（`trial` / `paid` / `admin` / `unavailable`）により機能制御を行い、Anthropic Claude と OpenAI モデルを用途に応じて切替します。
- チャット履歴検索は Supabase RPC `search_chat_sessions`（`pg_trgm` + `tsvector`）を利用し、サイドバーの検索バーからタイトルや正規化済み URL を横断検索できます。

## コミュニケーションと回答スタイル

- すべての応答は日本語で行ってください。
- コマンド出力は要点を抜粋し、無制限な貼り付けを避けます。
- 不明点があれば推測せず、ユーザーに確認を取ってください。

## 開発ワークフローの原則

- 可能な限り段階的な作業計画を共有し、重要な差分を逐次報告します。
- ファイル操作は `apply_patch` を用いた最小編集が基本です。生成物や整形は専用コマンドを使用します。
- `rg` / `rg --files` を優先してリポジトリを探索してください。
- 作業の終わりに `npm run lint` を実行し、結果を共有します（実行できない場合は理由を明記）。
- Supabase スキーマを変更する際は `supabase/migrations/` に SQL を追加し、ロールバック案をコメントで残します。
- 作業完了時は新規ファイルを含めて `git diff` を確認し、`When finished, review git diff including new files and generate a one-line commit message summarizing the changes` の指針どおり一行のコミットメッセージを生成してください。**コミットメッセージは必ず日本語で記述します。**

## プロジェクト構造の把握

### ディレクトリ構成

- `app/` — Next.js App Router の各機能境界。`chat`, `analytics`, `business-info`, `setup`, `subscription`, `admin`, `api` が主要な機能単位です。
- `src/components/` — shadcn/ui ベースの共通 UI コンポーネント群（CanvasPanel, AnnotationFormFields など）。
- `src/domain/` — フロント向けサービス層（`ChatService`, `SubscriptionService` など）。クライアント側のビジネスロジックを集約。
- `src/hooks/` — カスタム React フック。
- `src/lib/` — ユーティリティと設定（`constants`, `prompts`, `client-manager` など）。
- `src/server/` — Server Actions・ミドルウェア・外部サービス連携（WordPress / Stripe / LLM / Supabase）。サーバーサイドの中核（Server Actions は `src/server/actions/`、共有スキーマは `src/server/schemas/`）。
- `src/types/` — 共通型定義。環境変数・チャット・WordPress などを集約し、フロント・サーバー双方で再利用。
- `supabase/migrations/` — PostgreSQL スキーマと RLS のマイグレーションファイル。追加時は README との整合性を保つこと。

### 設定ファイルの方針

- ルート直下の設定ファイル（`eslint.config.mjs`, `next.config.ts`, `postcss.config.mjs` など）が唯一のソース・オブ・トゥルースです。
- フォルダ別の設定を増やさず、プロジェクト全体で統一された設定を維持してください。

## ビルド・テスト・開発コマンド

- `npm run dev` ― `tsc-watch` + `next dev --turbopack`
- `npm run build` / `npm run start` ― 本番ビルドと動作確認
- `npm run lint` ― ESLint（Next/Tailwind）＋ Prettier 連携
- `npm run ngrok` ― LIFF 実機検証用 HTTPS トンネル
- `npx supabase db push` ― Supabase スキーマ反映（本番反映前は要確認）

## コーディングスタイル

- TypeScript ファースト。共有型は `src/types/` に追加し、フロント・サーバー双方で再利用します。
- TypeScript でオブジェクトの形状を表す場合は、可能な限り `interface` を使用してください（`type` は `interface` で表現できないケースに限定）。
- Tailwind CSS でスタイルを記述し、冗長なユーティリティクラスは `cva` などで整理します。
- React コンポーネント・カスタムフックは PascalCase / camelCase を徹底。サーバー専用ファイルは `.server.ts` / `.action.ts` を語尾に付けます。
- 既存の hooks/service クラス（`ChatService`, `SubscriptionService` 等）を流用し、重複実装を避けてください。
- Supabase 呼び出しは `src/server/services/SupabaseService` 経由に統一し、直接 `createClient` を増やさないこと。

## テストと検証

- 重要フロー（LIFF 認証、Stripe、WordPress 投稿取得、Canvas 編集）はローカルで手動検証し、手順や想定結果を PR に記述します。
- Stripe・WordPress・LIFF は本番キーとサンドボックスで環境変数が変わるため、変更時は README と `.env.local` 用のメモを更新します。

## ドキュメントとナレッジ

- README / CLAUDE.md / AGENTS.md はプロジェクトの入口です。機能追加・環境変数変更・マイグレーション追加時は必ず最新情報を反映します。
- 画面変更やフロー追加を行った場合は、スクリーンショットや再現手順を PR に添付し、関係者が即座に追体験できるよう配慮してください。

## 注意事項

- 不要な `git reset --hard` や `git checkout --` など、破壊的なコマンドは使用禁止です。
- 作業中に予期しない変更を検知した場合は即座にユーザーへ確認を取り、勝手に破棄しないでください。
- ネットワークアクセスや権限昇格が必要なコマンドは、事前に明確な目的と理由を添えて承認を得ます。

上記方針に従うことで、複数エージェントや複数人での開発でも一貫性と安全性を保ちながら進められます。

## 選択肢の提示方法

選択肢を提示する時は、以下のように推奨度と理由を記載する。
1. 選択肢A（推奨度：⭐の5段階評価）
   - 理由:

## 企画評価の多角的視点

企画の場合、3つの異なる立場から評価してください。

1. CFO(最高財務責任者)の視点
   - コスト、ROI、財務リスクを重視

2. エンジニアリングマネージャーの視点
   - 技術的実現可能性、リソース、保守性を重視

3. エンドユーザーの視点
   - 使いやすさ、価値、満足度を重視

各視点から率直な懸念点を述べてください。
