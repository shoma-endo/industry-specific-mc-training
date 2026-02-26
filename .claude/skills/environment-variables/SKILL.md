---
name: environment-variables
description: 環境変数の定義、バリデーション、同期、およびアクセスのための厳格な規約。src/env.ts と README.md の整合性維持。
metadata:
  short-description: 環境変数・設定管理規約
---

# 環境変数・設定管理技術規約

このプロジェクトでは、環境変数の「定義（型定義）」「バリデーション」「ドキュメント」が常に同期していることを絶対条件とします。

## 1. 唯一のソース・オブ・トゥルース (SSoT)

環境変数の最新状態は以下の 2 箇所に集約されます。

1.  **実装**: `src/env.ts` (Zod スキーマによる実行時バリデーション)
2.  **ドキュメント**: `README.md` (環境変数セクション)

これらは互いに欠けることなく、常に一致していなければなりません。

## 2. 環境変数の追加手順

新しい環境変数を導入する場合、必ず以下の 3 ステップをセットで実施してください。

### ステップ 1: `src/env.ts` への定義追加

用途に応じて適切なスキーマに Zod 定義を追加します。

```ts
// src/env.ts

const clientEnvSchema = z.object({
  // クライアント(ブラウザ)からも参照可能な変数 (NEXT_PUBLIC_ プレフィックス必須)
  NEXT_PUBLIC_NEW_FEATURE_ID: z.string().min(1),
});

const serverEnvSchema = z.object({
  // サーバーサイド専用変数 (機密情報、API キーなど)
  NEW_FEATURE_API_KEY: z.string().min(1),
  OPTIONAL_SETTING: z.string().optional(),
});
```

### ステップ 2: ランタイムマッピングと可視性制御の追加

`clientRuntimeEnv` または `serverRuntimeEnv` に加え、アクセス制御用セット (`serverOnlyKeys`, `clientKeys`) にもキーを追加します。

```ts
// src/env.ts

const serverRuntimeEnv = {
  // ...
  NEW_FEATURE_API_KEY: process.env.NEW_FEATURE_API_KEY,
};

const serverOnlyKeys = new Set<keyof ServerEnv>([
  // ...
  'NEW_FEATURE_API_KEY',
]);
```

### ステップ 3: `README.md` の更新

環境変数の一覧表に、新しい変数の「カテゴリ」「必須/任意」「用途」を追記します。

## 3. アクセス・セキュリティ規約

### 3.1 `env` オブジェクトの使用

環境変数へのアクセスは、常に `@/env` から導出される `env` オブジェクトを経由してください。`process.env` を直接使用してはいけません。

```ts
// ✅ 正しい例
import { env } from '@/env';
const apiKey = env.NEW_FEATURE_API_KEY;

// ❌ 誤った例
const apiKey = process.env.NEW_FEATURE_API_KEY;
```

### 3.2 境界防御 (Boundary Protection)

`env` オブジェクトには Proxy が設定されており、以下のチェックが行われます。

1.  スキーマに定義されていないキーへのアクセスはエラーをスロー。
2.  サーバー専用変数をクライアント（`'use client'` コンポーネント等）から参照しようとした場合、エラーをスロー。

### 3.3 クライアント露出の制限

機密情報（API キー、DB 接続文字列など）を `clientEnvSchema` に入れてはいけません。誤って `NEXT_PUBLIC_` を付けてブラウザに露出させないよう、厳格にコードレビューを実施してください。

## 4. セルフレビュー項目

- [ ] 新しい変数は `src/env.ts` の `clientEnvSchema` または `serverEnvSchema` に正しく定義されているか
- [ ] `serverOnlyKeys` / `clientKeys` セットにキー名が追加されているか
- [ ] `README.md` の環境変数セクションが更新されているか
- [ ] コード内で `process.env` を直接参照せず、`@/env` の `env` を使用しているか
- [ ] 機密情報が誤って `NEXT_PUBLIC_` プレフィックス付きで定義されていないか
