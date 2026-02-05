# CTOアーキテクチャレビュー v3

## 総評

LINE LIFF認証を軸にしたB2B SaaS として、Next.js App Router / Supabase / Stripe / Anthropic を組み合わせた構成は合理的。型安全性・環境変数保護・RLSアクセス制御の基盤が整備されている（各根拠は「評価できる点」セクションに記載）一方、急速な機能追加による「巨大ファイル問題」と「層設計規約の逸脱」が技術的負債として顕在化し始めている。

---

## アーキテクチャ分類

### 主分類: 第10章 モジュール型モノリス

単一デプロイ単位のNext.jsアプリで、機能ドメインごとのフォルダ分割があり、結合はTypeScript import。

- `app/` 配下に `chat`, `analytics`, `gsc-dashboard`, `setup`, `admin` 等の機能ドメインが配置
- `src/server/services/` にドメインサービスが集約
- `src/server/actions/` にServer Actionsが機能別に配置
- モジュール間はネットワーク越しの通信ではなく、直接のTypeScript importで結合

**境界の曖昧化**: `src/server/services/supabaseService.ts`（1,695行）が全テーブル操作を単一クラスで担い、チャット・ユーザー・アノテーション・WordPress・GSC等あらゆるドメインから参照されている。これはモジュール型モノリスの典型的な劣化パターンであり、放置すると純粋なモノリスに退行するリスクがある。

### 副次特性: 第2章 多層アーキテクチャ（弱い）

以下の層構造は存在するが、**層の跨ぎが複数箇所で確認されており「厳密な多層」ではない**。

```
Presentation Layer    : app/ (Pages, Components), src/components/, src/hooks/
Application Layer     : src/server/actions/ (Server Actions), app/api/ (Route Handlers)
Domain Layer          : src/domain/ (Services, Errors), src/lib/prompts/
Infrastructure Layer  : src/server/services/ (Supabase, Stripe, LLM), src/lib/client-manager.ts
Data Layer            : Supabase (PostgreSQL + RLS), supabase/migrations/
```

**層の跨ぎの具体例:**

1. **Presentation層 から Infrastructure層への直結（Application層・Domain層を完全バイパス）**:
   - `app/setup/page.tsx:6` で `SupabaseService` を直接import・インスタンス化し、`:47` `:51` `:58` でDB操作を直接実行
   - `app/setup/gsc/page.tsx:5` でも同様に `SupabaseService` を直接import（`:10` でインスタンス化、`:32` でDB操作）
2. **Application層 から Infrastructure層への直結（Domain層バイパス）**: Server Actionsの大半が `SupabaseService` を直接呼び出し、Domain層を経由していない。確認された箇所:
   - `src/server/actions/gscNotification.actions.ts:5`
   - `src/server/actions/gscSetup.actions.ts:5`
   - `src/server/actions/gscDashboard.actions.ts:5`
   - `src/server/actions/brief.actions.ts:4`
   - `src/server/actions/chat.actions.ts:12`
   - `src/server/actions/googleAds.actions.ts:4`
   - `src/server/actions/wordpress.actions.ts:8`
   - `src/server/actions/wordpressImport.actions.ts:6`
3. **Server ActionsとRoute Handlersの責務境界が不明確**: 同一機能に対して両方が存在するケースがある

### 副次特性: 第11章 サーバーレス

Vercelホスティング + `app/api/**/route.ts` による関数単位の構成。

`maxDuration` はルート単位で設定されており、特定のサーバーレス関数に対するタイムアウト制御として実装されている:

| ルート | maxDuration | 用途 |
|--------|-------------|------|
| `app/api/chat/anthropic/stream/route.ts:14` | 800秒 | AIチャットストリーミング |
| `app/api/chat/canvas/stream/route.ts:13` | 800秒 | Canvas編集ストリーミング |
| `app/api/cron/gsc-evaluate/route.ts:51` | 300秒 | GSC定期評価バッチ |

ステートレス設計（セッション状態はSupabase + cookieに外部化）もサーバーレスの特性に合致する。

### 該当しないアーキテクチャ

| 章 | アーキテクチャ | 不該当の理由 |
|----|--------------|-------------|
| 第1章 | モノリシック | 機能ドメイン別のフォルダ分割とモジュール構造が存在するため、純粋なモノリスではない |
| 第3章 | パイプライン | データの段階的変換パイプラインではない。SSEは存在するが内部処理はパイプライン構成ではない |
| 第4章 | マイクロカーネル | コアシステムとプラグインの構成ではない。拡張ポイントやプラグイン機構が未実装 |
| 第5章 | SOA | サービスレジストリやESBが存在しない。サービス間通信はTypeScript importで完結 |
| 第6章 | EDA | イベントバスやメッセージキューが存在しない。SSEはUI配信手段であり内部イベント駆動ではない |
| 第7章 | スペースベース | 分散ノードやデータレプリケーション戦略が存在しない |
| 第8章 | オーケストレーション主導SOA | 集中型オーケストレータが存在しない |
| 第9章 | マイクロサービス | 独立デプロイ可能なサービスに分割されていない。全機能が単一デプロイ単位 |
| 第12章 | クリーンアーキテクチャ | 依存関係の逆転(DI)が徹底されていない。Infrastructure層がDomain層を直接依存する箇所あり |
| 第13章 | オニオンアーキテクチャ | 同心円状の層構成と厳密な依存方向の制約が実装されていない |

---

## 評価できる点

### 1. 型安全性の設計

**根拠:**

- **TypeScript strict**: `tsconfig.json:7` で `strict: true` を有効化。さらに `:26`-`:39` で `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `useUnknownInCatchVariables` 等を個別に有効化しており、TypeScriptの厳格モードを最大限活用している
- **環境変数Proxy保護**: `src/env.ts:97`-`:147` でZodスキーマ + `Proxy` によるサーバー専用環境変数の漏洩防止を実装。`:3`-`:10` でクライアント変数、`:12`-`:28` でサーバー変数のZodスキーマを定義。クライアント側からサーバー専用変数にアクセスすると `:111`-`:112` で即座にエラーをスロー
- **Zodランタイムバリデーション**: `src/server/schemas/chat.schema.ts` と `src/server/schemas/brief.schema.ts` でServer Actions入力のランタイムバリデーションを実装
- **型変換の2層構造**: `src/types/database.types.ts`（Supabaseから自動生成）からドメインモデル（`src/types/user.ts`, `src/types/chat.ts`）への変換関数を用意

### 2. SSEストリーミング実装

**根拠:**

- **20秒間隔ping**: `app/api/chat/anthropic/stream/route.ts:170`-`:175` で `setInterval(() => { ... }, 20000)` を実装し、アイドル切断を防止
- **5分アイドルタイムアウト**: 同ファイル `:156`-`:159` で `setTimeout(() => { abortController?.abort(); }, 300000)` を設定。チャンク受信またはping送信のたびにタイマーをリセット（`:154` の `resetIdleTimeout`）
- **同一パターンの適用**: `app/api/chat/canvas/stream/route.ts:288`-`:308` でも同一のping + idleタイムアウトパターンを実装
- **Anthropic prompt caching**: `app/api/chat/anthropic/stream/route.ts:130` で会話履歴末尾に `cache_control: { type: 'ephemeral' as const }` を設定、`:203` でsystemプロンプトにも同様に適用。`app/api/chat/canvas/stream/route.ts:327` `:433` `:641` と `src/server/services/llmService.ts:113` でも同様に適用

### 3. RLS + Service Roleの使い分け

**根拠:**

- **get_accessible_user_ids RPC**: `supabase/migrations/20260107000000_add_get_accessible_user_ids.sql` で定義。オーナー実行時は「自分+全スタッフ」、スタッフ実行時は「自分+オーナー」のIDリストを返却
- **RLSポリシー適用**: `supabase/migrations/20260107000002_update_rls_policies.sql` で `chat_sessions`, `chat_messages`, `content_annotations`, `wordpress_settings`, `gsc_credentials` 等9テーブルに `get_accessible_user_ids` を用いたRLSポリシーを適用
- **Service Roleクライアント保護**: `src/lib/client-manager.ts` のシングルトンパターンでService Roleクライアントの生成を制御し、`typeof window !== 'undefined'` チェックでクライアント側からのアクセスを防止

### 4. ドメインエラー階層

**根拠:**

- **基底クラス**: `src/domain/errors/BaseError.ts` に `DomainError` を定義（`code`, `userMessage`, `context`, `timestamp` を保持）
- **継承クラス**: `src/domain/errors/ChatError.ts`（Anthropic APIエラーのHTTPステータスマッピング含む）、`src/domain/errors/LiffError.ts`、`src/domain/errors/SubscriptionError.ts` が継承
- **メッセージ分離**: ユーザー向けメッセージ（`userMessage`）と開発者向けメッセージ（`message`）を分離し、UIにはユーザー向けのみを表示

---

## 重大な懸念事項

### 1. 巨大ファイル問題（最優先で対処すべき）

| ファイル | 行数 | 問題 |
|---------|------|------|
| `src/server/services/supabaseService.ts` | 1,695行 | 全テーブル操作が1クラスに集約（God Class） |
| `src/server/actions/wordpress.actions.ts` | 1,633行 | 複数責務が混在 |
| `app/chat/components/ChatLayout.tsx` | 1,507行 | UIオーケストレーション全体が1コンポーネント |
| `app/chat/components/CanvasPanel.tsx` | 1,393行 | エディタとエクスポートとバージョン管理が混在 |

**どの層の設計規約が破られているか:**

`src/server/services/supabaseService.ts` は本来Infrastructure層としてドメイン別に分割されるべきだが、単一クラスが全ドメインのDB操作を担っている。さらに上記「層の跨ぎ」で示したとおり、Server Actions（Application層）の8ファイルすべてがDomain層を経由せずこのGod Classを直接呼び出している。結果としてApplication層からInfrastructure層への直結が事実上の標準経路となり、Domain層（`src/domain/`）が形骸化している。

### 2. フロントエンド状態管理の限界

React Context + `useState` のみで状態管理ライブラリなし。

- **Prop Drilling**: `ChatLayout` から5階層以上のバケツリレー
- **再レンダリング最適化不足**: `useMemo` / `useCallback` の戦略的適用が不足
- **重複パターン**: 複数フックで同じローディング/エラーパターンを手動実装

### 3. エラーハンドリングの不統一

3つの異なるパターンが混在:

| 箇所 | パターン |
|------|---------|
| Server Actions | `{ success: false, error: string }` |
| API Routes (SSE) | `sendSSE('error', { type: code, message: string })` |
| Services | `throw ChatError` または `return { success, error: {...} }` |

**useEffect内の未処理Promise rejectionの具体例:**

- `src/components/LiffProvider.tsx:159`: `syncWithServerIfNeeded()` をawaitせずに呼び出し。内部にtry/catchはあるが、PromiseのrejectionがuseEffectレベルで捕捉されない
- `src/components/LiffProvider.tsx:184`: `refreshUser()` をsetTimeoutコールバック内でawaitせず呼び出し
- `src/components/LiffProvider.tsx:223`: `checkSession()` をawaitせず呼び出し
- `src/hooks/useGscSetup.ts:69`: `refetchProperties()` をawaitせず呼び出し（ただし内部で`handleAsyncAction`ラッパーによりエラーハンドリング済みのため軽微）

### 4. レート制限・リクエスト重複排除の欠如

**レート制限の不在:**

`src/server/services/chatLimitService.ts:5` でトライアルユーザーの日次制限を `DAILY_CHAT_LIMIT = 3` と定義。`:32`-`:35` で `role !== 'trial'` の場合は即座に `null`（制限なし）を返却しており、有料ユーザーへのレート制限は一切存在しない。この関数は `app/api/chat/anthropic/stream/route.ts:91` と `app/api/chat/canvas/stream/route.ts:171` から呼び出されるが、有料ユーザーは無制限にAnthropic APIを呼び出せる状態。

**リクエスト重複排除なし:**

Server Actionの呼び出しにdebounceやdeduplication機構がなく、連打で同一クエリが多重実行される。

**トークンリフレッシュのmutex不在:**

`src/server/services/lineAuthService.ts:77` でトークンリフレッシュが実行されるが、mutex/lock/deduplication機構がない。並行リクエストが同時に期限切れトークンを検出した場合、複数の `refreshToken()` 呼び出しがLINE APIに並行発行され、後発のcookie書き込みが先発を上書きしてトークン不整合が発生する可能性がある。

### 5. N+1クエリの実例

**具体例:** `src/server/services/gscImportService.ts:167`-`:204` の `upsertPageMetrics` メソッド

`metrics` 配列をforループで反復し、各要素に対して `supabase.from('gsc_page_metrics').upsert()` を個別実行している。メトリクス100件で100回のDB呼び出しが発生する。

同ファイル `:512`-`:513` の `gscQueryMetrics` では `upsertGscQueryMetrics()` によるバッチ処理が実装済みであり、`upsertPageMetrics` にも同様のバッチ化が適用可能。

---

## セキュリティ観点

### 良い点

- Service Roleのクライアント側アクセス防止（`src/lib/client-manager.ts` で `typeof window !== 'undefined'` チェック）
- View Modeのサーバー側検証（`src/server/middleware/auth.middleware.ts` で `viewUser.ownerUserId === actor.id` を検証）
- HttpOnly + Secure + SameSite cookies
- サーバー専用環境変数のクライアント側漏洩防止（`src/env.ts:111`-`:112` のProxy）

### 懸念点

- CSRFトークン未実装（SameSite cookieのみに依存）
- トークンリフレッシュエンドポイント（`app/api/refresh/route.ts`）のレート制限なし
- 一部APIエンドポイントでZodバリデーション未適用（例: `app/api/gsc/dashboard/route.ts` のクエリパラメータ）

---

## スケーラビリティ観点

### 現状の設計限界

- Supabaseの接続プーリングに依存（Serverless環境では接続枯渇リスク）
- SSEストリーミングはサーバーメモリを保持するため、同時接続数に制約
- マイグレーション95本超（`supabase/migrations/` 配下）は管理コスト増大の兆候（squash検討時期）

### 将来課題

- マルチテナント化（現状は `user_id` ベースのフィルタリングのみ）
- キャッシュ戦略（Redis等の外部キャッシュなし）
- バックグラウンドジョブ（GSC評価の `app/api/cron/gsc-evaluate/route.ts` は外部スケジューラ依存）

---

## 推奨アクションプラン（優先度順）

| 優先度 | 施策 | 影響範囲 | 検証方針 |
|-------|------|---------|---------|
| **P0** | `supabaseService.ts` のドメイン別分割 | Server Actions 8ファイル、API Routes全域。`src/server/services/` 配下に `supabaseChatService.ts`, `supabaseUserService.ts`, `supabaseGscService.ts` 等を新設 | 分割後に全Server Actionsのimportパスが正常に解決されることを確認。`npm run lint` と `npm run build` で型エラーなし |
| **P0** | 全APIエンドポイントへのZod入力バリデーション追加 | `app/api/` 配下の33ルート。特に `app/api/gsc/dashboard/route.ts` 等のクエリパラメータ | 各エンドポイントに対し不正入力でのレスポンスコード確認（400返却）。`src/server/schemas/` にスキーマ追加 |
| **P1** | `ChatLayout.tsx` の責務分割とContext導入 | `app/chat/` 配下のコンポーネント全体 | チャット機能の手動検証（送信・受信・Canvas編集・サイドバー操作） |
| **P1** | 有料ユーザー向けレート制限の導入 | `src/server/services/chatLimitService.ts` と両SSEエンドポイント | Anthropic APIコスト監視と連動し、一定閾値で429返却を確認 |
| **P1** | トークンリフレッシュのmutex実装 | `src/server/services/lineAuthService.ts:77` と `app/api/refresh/route.ts` | 並行リクエスト発行時にリフレッシュが1回のみ実行されることをログ確認 |
| **P2** | エラーハンドリングパターンの統一 | Server Actions、API Routes、Services全域 | エラー発生時のレスポンス形式が統一されていることをAPI呼び出しで確認 |
| **P2** | Sentry等のオブザーバビリティ導入 | 本番環境全体 | エラー発生時にダッシュボードで捕捉されることを確認 |
| **P3** | マイグレーションのsquash | `supabase/migrations/`（95本超） | squash後に `supabase db push` が正常完了することを確認 |
| **P3** | E2Eテスト基盤の構築 | プロジェクト全体 | 主要ユーザーフロー（ログイン、チャット、設定）のE2Eテストがパスすること |

---

## 3視点評価

### CFO視点

- Supabase + Vercelのサーバーレス構成はランニングコストが低く適切
- Anthropic APIのコスト管理がトライアル日次制限（3回/日、`chatLimitService.ts:5`）のみ。有料ユーザーの利用量上限がないため、ヘビーユーザーによるコスト急騰リスクあり
- テスト基盤の不在は、障害発生時の復旧コストを押し上げる要因

### エンジニアリングマネージャー視点

- 1人から少人数での開発には十分整理された構成
- 1,500行超のコンポーネント（`ChatLayout.tsx`, `CanvasPanel.tsx`）は新規メンバーのオンボーディング障壁
- 自動テスト不在のため、リファクタリング時のリグレッションリスクが高い
- CLAUDE.mdの指示が詳細で、AI支援開発との相性は良い

### エンドユーザー視点

- LINE LIFF認証によるシームレスなログイン体験は良い
- SSEストリーミングによるリアルタイムAI応答はUXとして適切
- Error Boundaryの不足により、エラー時にUIが壊れる可能性がある
- オフライン/低速回線対応の考慮がない

---

## 結論

**モジュール型モノリスが主分類**であり、現在のプロジェクト規模（TSファイル144、APIルート33）には適切な選択。多層アーキテクチャの特性も持つが、`app/setup/page.tsx`, `app/setup/gsc/page.tsx` の SupabaseService直接参照（Presentation層からInfrastructure層への直結）や、Server Actions 8ファイルでのDomain層バイパスに見られるように層の分離は厳密ではない。サーバーレスの特性はVercelデプロイとルート単位の `maxDuration` 設定（上記3ルート）で実現されている。

進化の方向としては、**モジュール型モノリスを維持しつつモジュール境界を再定義する**のが最善。クリーンアーキテクチャやマイクロサービスへの移行は、現在のチーム規模・トラフィック量では過剰設計となる。
