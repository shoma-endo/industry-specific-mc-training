# チャットトークン使用量 仕様書（方針1: 新規テーブル）

## 目的
AIチャット利用のトークン使用量を「1リクエスト単位」で永続化し、月次集計・ユーザー別・モデル別の可視化と、将来の課金/上限設計に耐えうる基盤を提供する。

## スコープ
- 対象: `/app/chat` のAIチャット（Anthropic/OpenAI）。
- 保存粒度: 1リクエスト = 1レコード。
- 集計単位: 月次（UTCで集計、表示はUIでタイムゾーン変換）。

## 期待するユースケース
- ユーザー別の「当月トークン使用量」表示
- 管理画面での使用量ランキング
- モデル/プロバイダ/機能別（serviceId）での使用量分析
- 将来の従量課金・上限アラート

## データモデル
新規テーブル `chat_token_usages` を作成する。

### カラム定義（案）
| カラム名 | 型 | Null | 説明 |
| --- | --- | --- | --- |
| id | uuid | NO | PK |
| user_id | text | NO | オーナー基準のユーザーID（スタッフは ownerUserId を使用） |
| session_id | text | YES | chat_sessions.id |
| message_id | text | YES | chat_messages.id（該当があれば） |
| service_id | text | YES | chat_sessions.service_id と同義 |
| provider | text | NO | `openai` / `anthropic` |
| model | text | NO | 実モデル名 |
| input_tokens | integer | NO | 入力トークン数 |
| output_tokens | integer | NO | 出力トークン数 |
| total_tokens | integer | NO | input + output（DBで整合性保証） |
| request_id | text | YES | 生成リクエストの識別子（追跡用） |
| created_at | timestamptz | NO | 生成日時（UTC） |

### インデックス（案）
- `(user_id, created_at)` 月次集計用
- `(session_id, created_at)` セッション集計用
- `(provider, model, created_at)` モデル別集計用

## 保存タイミング
以下のタイミングで usage を記録する。

1. `app/api/chat/anthropic/stream/route.ts`
   - `message_delta` の `chunk.usage` 取得時点で記録
2. `src/server/services/llmService.ts`
   - OpenAI/Anthropic の非ストリーミング呼び出し完了時点で記録

## 権限・RLS方針
- 既存の `get_accessible_user_ids` を利用し、スタッフはオーナーのデータに集約。
- RLS:
  - select: `user_id = any (get_accessible_user_ids(auth.uid()))`
  - insert: サービスロールのみ許可（サーバー側で一元記録）

## 集計クエリ（例）
**月次トークン合計（ユーザー別）**
```sql
select
  date_trunc('month', created_at) as month,
  user_id,
  sum(total_tokens) as total_tokens
from chat_token_usages
where user_id = :user_id
  and created_at >= date_trunc('month', now())
group by 1, 2;
```

**モデル別使用量**
```sql
select
  provider,
  model,
  sum(total_tokens) as total_tokens
from chat_token_usages
where user_id = :user_id
  and created_at >= date_trunc('month', now())
group by 1, 2
order by total_tokens desc;
```

## マイグレーション方針
- `supabase/migrations/` に新規SQLを追加。
- Rollback案をSQLコメントで記載する（既存方針に準拠）。

## データ整合性（total_tokens）
`total_tokens` は手動計算による不整合を避けるため、以下のいずれかを採用する（推奨: GENERATED）。

1. **GENERATED カラム（推奨）**
   ```sql
   total_tokens integer GENERATED ALWAYS AS (input_tokens + output_tokens) STORED
   ```

2. **CHECK 制約**
   ```sql
   CONSTRAINT chk_total_tokens CHECK (total_tokens = input_tokens + output_tokens)
   ```

## アプリケーションコード要件（GENERATED 採用時）
GENERATED カラムを採用する場合、アプリケーション側は以下を厳守する。

- **INSERT で `total_tokens` を指定しない**（指定すると PostgreSQL がエラー）
- **UPDATE で `total_tokens` を変更しない**（同上）
- 影響範囲の実装（`app/api/chat/anthropic/stream/route.ts` / `src/server/services/llmService.ts` など）では、挿入・更新の payload から `total_tokens` を除外する

例: INSERT（`total_tokens` を含めない）
```sql
INSERT INTO chat_token_usages (
  id, user_id, session_id, message_id, service_id,
  provider, model, input_tokens, output_tokens,
  request_id, created_at
) VALUES (...);
```

## 既存データの扱い
- 過去分は計測不可のため、仕様開始日以降のみ集計。

## 監査・ログ
- `request_id` でエラー/再生成の追跡を可能にする。
- 異常値（total_tokens < 0 など）は記録拒否。

## 影響範囲
- API: `app/api/chat/anthropic/stream/route.ts`
- サービス: `src/server/services/llmService.ts`
- DB: Supabase migration（新規テーブル）
- UI: 既存 `app/analytics` での表示拡張（別途タスク）
