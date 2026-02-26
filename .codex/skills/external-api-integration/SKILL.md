---
name: external-api-integration
description: Google Ads, GSC, GA4, WordPress 等の外部 API 連携における、認証管理、サービス層の設計、およびエラーハンドリングの統一パターン。
metadata:
  short-description: 外部 API 連携設計規約
---

# 外部 API 連携設計規約

複数の外部サービス（Google, WordPress, Stripe 等）と連携する GrowMate において、保守性と堅牢性を確保するための実装パターンを定義します。

## 1. レイヤ構造

外部 API 連携は以下の 3 層に分離して実装してください。

### 1.1 Credential / Token Layer

認証情報の取得・保存・リフレッシュを専門に担当します。

- `googleTokenService.ts`: Google 系 (Ads, GSC, GA4) の OAuth トークン管理。
- `WordPressService` (OAuth 関連メソッド): WordPress.com のトークン管理。

### 1.2 Service Layer (`src/server/services/`)

ビジネスロジックと API 呼び出しをカプセル化します。

- **責務**:
  - `src/env.ts` から必要な API キーやシークレットを読み込む。
  - Token Layer から最新のトークンを取得し、認証済みクライアントを生成。
  - 外部 API からのレスポンス（生のデータ）をアプリケーション内のドメインモデルに変換。
  - 外部 API の特殊なエラーを、共通のドメインエラー（`ChatError` 等）にマッピング。

### 1.3 Action / Route Layer (`src/server/actions/`, `app/api/`)

UI や外部 Cron からの要求を受け付け、Service を呼び出します。

- **責務**: `ServerActionResult` 形式での結果返却、再認証が必要な場合のフラグ返却（`needsReauth`）。

## 2. 実装パターン

### 2.1 Google API 連携の基本形

```ts
// src/server/services/exampleService.ts
import { google } from 'googleapis';
import { googleTokenService } from './googleTokenService';
import { env } from '@/env';
import { ChatError } from '@/domain/errors/ChatError';

export class ExampleService {
  private async getClient(userId: string) {
    const auth = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URI
    );

    // トークンの取得とリフレッシュの委譲
    const credentials = await googleTokenService.getCredentials(userId);
    auth.setCredentials(credentials);

    return google.example({ version: 'v1', auth });
  }

  async fetchData(userId: string) {
    try {
      const client = await this.getClient(userId);
      const res = await client.data.list();
      return this.transform(res.data);
    } catch (error) {
      // 外部 API エラーをドメインエラーに変換
      throw ChatError.fromApiError(error, { service: 'example' });
    }
  }
}
```

### 2.2 エラーハンドリング規約

外部 API からの `401 Unauthorized` や `403 Forbidden` を検知した場合、以下の情報を付与してスローしてください。

1.  **再認証フラグ**: トークンが失効しているか、スコープが不足している場合。
2.  **ユーザー向けメッセージ**: `ERROR_MESSAGES.GSC.AUTH_EXPIRED_OR_REVOKED` 等。

## 3. ベストプラクティス

- **バッチ処理・分割**: 大量のデータ（GSC の 10,000 件以上のクエリ等）を取得する場合、サービス内で自動的にチャンク分割して取得してください。
- **タイムアウト設定**: 外部 API は応答が遅れる可能性があるため、必ずタイムアウトを明示的に設定してください（デフォルト 30〜60 秒推奨）。
- **リトライロジック**: `429 Too Many Requests` 等の一時的なエラーに対しては、指数バックオフ等によるリトライを検討してください。

## 4. セルフレビュー項目

- [ ] 認証管理（トークン取得・保存）は `TokenService` に集約されているか
- [ ] 外部 API 固有のデータ型をそのまま Action 層へ漏らしていないか（ドメインモデルへの変換がなされているか）
- [ ] 外部エラーを `ChatError` や `BaseError` に適切に変換しているか
- [ ] `src/env.ts` の `env` オブジェクトから API 設定を取得しているか
- [ ] 大量データ取得時のページネーション処理が実装されているか
