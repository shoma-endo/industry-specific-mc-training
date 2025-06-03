This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

ローカル起動コマンド
ngrok http --region=jp --subdomain=industry-specific-mc-training 3000

## 主要機能

### Draft Mode（プレビュー機能）

- Sanity Studio でのリアルタイムプレビュー
- 下書き状態のコンテンツを安全にプレビュー
- 認証トークンによるセキュリティ

### WordPress エクスポート

- Sanity のランディングページを WordPress サイトに投稿として出力
- WordPress Application Passwords による認証
- 接続テスト機能
- 下書き・公開ステータスの選択
- フィーチャード画像の自動アップロード

## Getting Started

First, run the development server:

```bash
npm i

npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
``
```

## WordPress エクスポート機能の使用方法

### 1. WordPress でアプリケーションパスワードを生成

1. WordPress 管理画面にログイン
2. ユーザー → プロフィール に移動
3. 「アプリケーションパスワード」セクションでパスワードを生成
4. 生成されたパスワードをコピーして保存

### 2. Sanity Studio でエクスポート

1. Sanity Studio（`/studio`）にアクセス
2. 上部メニューから「WordPress エクスポート」ツールを選択
3. 必要な情報を入力：
   - ランディングページのスラッグ
   - WordPress サイト URL
   - WordPress ユーザー名
   - アプリケーションパスワード
4. 「接続テスト」で WordPress サイトとの接続を確認
5. 「WordPressにエクスポート」で実行

### 3. デバッグページでテスト

開発中は `/debug/wordpress-export` でエクスポート機能をテストできます。

## 技術スタック

- フレームワーク

  - Next.js (v15.2.3)
  - React (v19.0.0)

- 言語・型チェック

  - TypeScript (v5)

- UI コンポーネント

  - Radix UI（Avatar, Checkbox, Dialog, Navigation Menu, Select, Slot, Tooltip）

- スタイリング

  - Tailwind CSS (v4)
  - tw-animate-css
  - tailwind-merge

- バックエンド／データベース

  - Supabase JavaScript SDK (@supabase/supabase-js v2.49.1)

- 外部連携

  - LINE Front-end Framework (LIFF) (@line/liff v2.25.1)
  - OpenAI API (openai v4.90.0)
  - Stripe API (stripe v17.7.0)

- ユーティリティ／ライブラリ

  - Zod (バリデーション v3.24.2)
  - clsx, class-variance-authority (CVA)
  - uuid

- 環境変数管理

  - @t3-oss/env-nextjs

- 開発・ビルドツール
  - tsc-watch (TypeScript のウォッチビルド)
  - Turbopack（Next.js のバンドラ）
  - ESLint／eslint-config-next／eslint-config-prettier
  - Prettier
  - dotenv
  - ngrok（ローカルサーバー公開用）
