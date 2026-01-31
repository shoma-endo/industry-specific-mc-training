# CTOアーキテクチャレビュー

## 総評

LINE LIFF認証を軸にしたB2B SaaS として、Next.js App Router / Supabase / Stripe / Anthropic を組み合わせた構成は合理的。TypeScript strict + Zod + 自動生成型による型安全性、環境変数のProxy保護、RLSベースのアクセス制御など、セキュリティ基盤はしっかりしている。ただし、急速な機能追加による「巨大ファイル問題」と「一貫性の欠如」が技術的負債として顕在化し始めている。

---

## アーキテクチャ分類

### 主分類: 第10章 モジュール型モノリス

単一デプロイ単位のNext.jsアプリで、機能ドメインごとのフォルダ分割があり、結合はTypeScript import。

- `app/` 配下に `chat`, `analytics`, `gsc-dashboard`, `setup`, `admin` 等の機能ドメインが配置
- `src/server/services/` にドメインサービスが集約
- `src/server/actions/` にServer Actionsが機能別に配置
- モジュール間はネットワーク越しではなく、直接のimportで結合

**境界の曖昧化**: `src/server/services/supabaseService.ts`（1,695行）が全テーブル操作を単一クラスで担い、チャット・ユーザー・アノテーション・WordPress・GSC 等あらゆるドメインから参照されている。これはモジュール型モノリスの典型的な劣化パターンであり、放置すると純粋なモノリスに退行するリスクがある。

### 副次特性: 第2章 多層アーキテクチャ（弱い）

以下の層構造は存在するが、**層の跨ぎが散見されるため「厳密な多層」ではない**。

```
┌─────────────────────────────────┐
│  Presentation Layer             │  app/ (Pages, Components)
│  └─ React Components + Hooks   │  src/components/, src/hooks/
├─────────────────────────────────┤
│  Application Layer              │  src/server/actions/ (Server Actions)
│  └─ Route Handlers + Actions   │  app/api/ (Route Handlers)
├─────────────────────────────────┤
│  Domain Layer                   │  src/domain/ (Services, Errors)
│  └─ Business Logic + Errors    │  src/lib/prompts/
├─────────────────────────────────┤
│  Infrastructure Layer           │  src/server/services/ (Supabase, Stripe, LLM)
│  └─ External Service Adapters  │  src/lib/client-manager.ts
├─────────────────────────────────┤
│  Data Layer                     │  Supabase (PostgreSQL + RLS)
│  └─ DB + Migrations            │  supabase/migrations/
└─────────────────────────────────┘
```

**層の跨ぎの具体例:**

1. **Presentation → Infrastructure 直結**: `app/setup/page.tsx:6` で `SupabaseService` を直接import・インスタンス化し、Application層・Domain層を完全にバイパスしている
2. **Application → Infrastructure 直結（Domain層バイパス）**: `src/server/actions/gscNotification.actions.ts:5` が `SupabaseService` を直接呼び出し、Domain層の `gscService` 等を経由していない
3. **Server Actions と Route Handlers の責務境界が不明確**: 同一機能に対して両方が存在するケースがある

### 副次特性: 第11章 サーバーレス

Vercelホスティング + `app/api/**/route.ts` による関数単位の構成。

`maxDuration` をルート単位で明示しており、サーバーレスのタイムアウト制御が実装されている:

| ルート | maxDuration | 用途 |
|-------|-------------|------|
| `app/api/chat/anthropic/stream/route.ts:14` | 800秒 | AI チャットストリーミング |
| `app/api/chat/canvas/stream/route.ts:13` | 800秒 | Canvas編集ストリーミング |
| `app/api/cron/gsc-evaluate/route.ts:51` | 300秒 | GSC定期評価バッチ |

ステートレス設計（セッション状態はSupabase + cookieに外部化）もサーバーレスの特性に合致する。

### 該当しないアーキテクチャ

| アーキテクチャ | 不該当の理由 |
|--------------|-------------|
| 第1章 モノリシック | 機能ドメイン別のフォルダ分割とモジュール構造が存在するため、純粋なモノリスではない |
| 第3章 パイプライン | データの段階的変換パイプラインではない。SSEストリーミングは存在するが内部処理はパイプライン構成ではない |
| 第4章 マイクロカーネル | コアシステム＋プラグインの構成ではない。拡張ポイントやプラグイン機構が未実装 |
| 第5章 SOA | サービスレジストリやESBが存在しない。サービス間通信はTypeScript importであり、標準プロトコルによるサービス間通信ではない |
| 第6章 EDA | イベントバス・メッセージキューが存在しない。SSEはUIへの配信手段であり、内部コンポーネント間のイベント駆動通信ではない |
| 第7章 スペースベース | 分散ノードやデータレプリケーション戦略が存在しない |
| 第8章 オーケストレーション主導SOA | 集中型オーケストレータが存在しない |
| 第9章 マイクロサービス | 独立デプロイ可能なサービスに分割されていない。全機能が単一デプロイ単位 |
| 第12章 クリーンアーキテクチャ | 依存関係の逆転（DI）が徹底されていない。Infrastructure層がDomain層に直接依存している箇所がある |
| 第13章 オニオンアーキテクチャ | 同心円状の層構成と厳密な依存方向の制約が実装されていない |

---

## 評価できる点

### 1. 型安全性の設計（高評価）

- `src/env.ts` の Proxy + Zod によるサーバー専用変数の漏洩防止
- `database.types.ts` の自動生成 → ドメインモデル変換の2層構造
- `authUtils.ts` のヘルパー関数によるロール判定の一元化

### 2. SSEストリーミング実装（高評価）

- 20秒間隔のping + 5分アイドルタイムアウトの組み合わせ（`app/api/chat/anthropic/stream/route.ts`）
- クライアントのdisconnect検知と適切なcleanup処理
- Anthropicのprompt caching（`cache_control: { type: 'ephemeral' }`）導入済み

### 3. RLS + Service Role の使い分け（適切）

- `get_accessible_user_ids` RPCによるオーナー/スタッフ共有アクセス
- `SupabaseClientManager` のシングルトンでService Roleのクライアント側漏洩を防止

### 4. ドメインエラー階層（構造的に良い）

- `BaseError` → `ChatError` / `LiffError` / `SubscriptionError` の階層
- ユーザー向けメッセージと開発者向けメッセージの分離

---

## 重大な懸念事項

### 1. 巨大ファイル問題（最優先で対処すべき）

| ファイル | 行数 | 問題 |
|---------|------|------|
| `src/server/services/supabaseService.ts` | 1,695行 | 全テーブル操作が1クラスに集約（God Class） |
| `src/server/actions/wordpress.actions.ts` | 1,633行 | 複数責務が混在 |
| `app/chat/components/ChatLayout.tsx` | 1,507行 | UIオーケストレーション全体が1コンポーネント |
| `app/chat/components/CanvasPanel.tsx` | 1,393行 | エディタ＋エクスポート＋バージョン管理 |

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
| API Routes（SSE） | `sendSSE('error', { type: code, message: string })` |
| Services | `throw ChatError` / `return { success, error: {...} }` |

`useEffect` 内の未処理Promise rejectionが散見される。Error Boundaryの適用範囲も限定的。

### 4. レート制限・リクエスト重複排除の欠如

- トライアルユーザーの日次制限（5回/日）はあるが、有料ユーザーへのレート制限なし
- Server Actionの重複リクエスト排除なし（連打で同一クエリが多重実行）
- トークンリフレッシュのmutex/lockがなく、並行リクエストで競合の可能性

### 5. N+1クエリの潜在リスク

セッション一覧取得後に個別メッセージをフェッチするパターンが存在。`get_sessions_with_messages` RPCで一部は対応済みだが、他のリレーション取得で同様の問題が残る。

---

## セキュリティ観点

### 良い点

- Service Role のクライアント側アクセス防止（`src/lib/client-manager.ts`）
- View Mode のサーバー側検証（`viewUser.ownerUserId === actor.id`）
- HttpOnly + Secure + SameSite cookies
- `src/env.ts` のProxy保護

### 懸念点

- CSRFトークン未実装（SameSite cookieのみに依存）
- トークンリフレッシュエンドポイントのレート制限なし
- 一部APIエンドポイントでZodバリデーション未適用（例: `/api/gsc/dashboard` のクエリパラメータ）

---

## スケーラビリティ観点

### 現状の設計限界

- Supabase の接続プーリングに依存（Serverless環境では接続枯渇リスク）
- SSEストリーミングはサーバーメモリを保持するため、同時接続数に制約
- マイグレーション102本は管理コスト増大の兆候（squash検討時期）

### 将来課題

- マルチテナント化（現状は `user_id` ベースのフィルタリングのみ）
- キャッシュ戦略（現状はインメモリ30秒TTLのみ、Redis等の外部キャッシュなし）
- バックグラウンドジョブ（GSC評価の `/api/cron/gsc-evaluate` は外部スケジューラ依存）

---

## 推奨アクションプラン（優先度順）

| 優先度 | 施策 | 理由 |
|-------|------|------|
| **P0** | `supabaseService.ts` のドメイン別分割 | 変更影響範囲の制御、テスタビリティ向上 |
| **P0** | 全APIエンドポイントへのZod入力バリデーション追加 | インジェクション防止 |
| **P1** | `ChatLayout.tsx` の責務分割 + Context導入 | 保守性・パフォーマンス改善 |
| **P1** | リクエスト重複排除の導入 | DB負荷軽減、UX改善 |
| **P1** | トークンリフレッシュのmutex実装 | 競合条件の排除 |
| **P2** | エラーハンドリングパターンの統一 | デバッグ効率向上 |
| **P2** | Sentry等のオブザーバビリティ導入 | 本番障害対応 |
| **P3** | マイグレーションのsquash | 運用コスト削減 |
| **P3** | E2Eテスト基盤の構築 | リグレッション防止 |

---

## 3視点評価

### CFO視点

- Supabase + Vercel のサーバーレス構成はランニングコストが低く適切
- Anthropic API のコスト管理が日次制限のみ。有料ユーザーの利用量上限がないと、ヘビーユーザーによるコスト急騰リスクあり
- テスト基盤の不在は、障害発生時の復旧コストを押し上げる要因

### エンジニアリングマネージャー視点

- 1人〜少人数での開発には十分整理された構成
- 1,500行超のコンポーネントは新規メンバーのオンボーディング障壁
- 自動テスト不在のため、リファクタリング時のリグレッションリスクが高い
- CLAUDE.md の指示が詳細で、AI支援開発との相性は良い

### エンドユーザー視点

- LINE LIFF認証によるシームレスなログイン体験は良い
- SSEストリーミングによるリアルタイムAI応答はUXとして適切
- Error Boundary の不足により、エラー時にUIが壊れる可能性がある
- オフライン/低速回線対応の考慮がない

---

## 結論

**モジュール型モノリスが主分類**であり、現在のプロジェクト規模（TSファイル144、APIルート33）には適切な選択。多層アーキテクチャの特性も持つが、`app/setup/page.tsx` の SupabaseService 直接参照や `gscNotification.actions.ts` の Domain層バイパスに見られるように層の分離は厳密ではない。サーバーレスの特性はVercelデプロイとルート単位の `maxDuration` 設定で実現されている。

進化の方向としては、**モジュール型モノリスを維持しつつモジュール境界を再定義する**のが最善。クリーンアーキテクチャやマイクロサービスへの移行は、現在のチーム規模・トラフィック量では過剰設計となる。
