---
name: error-handling-and-messages
description: Next.js(App Router)・OpenAPI・openapi-fetch を前提とした、エラーハンドリングと表示メッセージの統一ルール。
---

# エラーハンドリング & メッセージ設計（SSoT）

このスキルは、**Network Boundary を跨ぐエラーの扱い**と、**ユーザー向けメッセージの一元管理**を徹底するための規約です。
アプリ全体のエラーメッセージは `src/domain/errors/error-messages.ts` を単一の正解 (SSoT) とします。

## 1. 基本方針（必須）

- **例外をそのままクライアントに渡さない**  
  Server Action から `Error.message` を直接表示しない。Network Boundary を跨いだ `Error` は production で秘匿される。
- **Server Action は「表示可能なエラー」を値として返す**  
  例外は `Result` 形式（`success` / `failure`）に畳み込み、`message` は **安全に表示できる文言**に限定する。
- **表示メッセージは必ず `ERROR_MESSAGES` を経由**  
  直接の日本語文字列を散在させない。
- **内部詳細はログに集約**  
  スタックトレースや技術情報はサーバー側でログ化し、ユーザー表示には出さない。

## 2. 推奨パターン

### 2.1 Server Action の戻り値

- 返却は `Result<Success, ApiError>` を採用。
- `failure` 側は `{ code, message }` を持つ **シリアライズ可能なオブジェクト** とする。
- `message` は `ERROR_MESSAGES` から生成する。

### 2.2 API クライアント（openapi-fetch）

- `openapi-fetch` のレスポンスは `withResult` などのユーティリティで `Result` 化する。
- 例外（ネットワークなど）は `Middleware.onError` で **Result 型に畳み込み**、`code` を付与する。

### 2.3 エラーコードと OpenAPI スキーマ

- API のエラーコードは **OpenAPI のスキーマで定義**し、型生成に反映する。
- `const` を使った文字列リテラルで **フロントの型安全**を確保する。

### 2.4 メッセージ変換（Server Action 側）

- エラーコード → 表示メッセージ変換は **Server Action で実施**。
- `switch` + `never` で **ハンドリング漏れを型で検知**。
- `default` では `ERROR_MESSAGES.COMMON.SERVER_ERROR` などを返す。

## 3. 実装ルール（必須）

1. **メッセージ追加は `src/domain/errors/error-messages.ts` に集約**
2. **Server Action は `Error` を throw せず `Result` を返す**
3. **クライアントは `result.error.message` を表示するだけに留める**
4. **取得系（Server Component / Route Handler）は `parseAsSuccessData` のようなユーティリティで簡潔化**
5. **OpenAPI のスキーマ更新を伴う場合は、型生成と同期を必ず確認**

## 4. アンチパターン

- [ ] Client Component で `Error.message` を直接表示する
- [ ] Server Action で例外をそのまま throw する
- [ ] メッセージ文字列を任意のファイルに直接書く
- [ ] API が返すエラーコードの網羅を `switch` で担保していない

## 5. セルフレビュー項目

- [ ] `ERROR_MESSAGES` に追加した文言が他用途で重複しないか
- [ ] Server Action の返却がシリアライズ可能な `Result` になっているか
- [ ] Network Boundary 越しに `Error.message` を使っていないか
- [ ] OpenAPI のエラーコード定義と変換ロジックが一致しているか
