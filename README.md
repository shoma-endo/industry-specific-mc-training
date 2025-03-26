This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Supabase Setup

このプロジェクトはSupabaseをデータベースとして使用しています。セットアップ方法は以下の通りです：

1. [Supabase](https://supabase.com/) でアカウントを作成し、新しいプロジェクトを作成します。
2. プロジェクトのURLと匿名キーを取得し、`.env.local` ファイルに設定します：

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

3. プロジェクトのマイグレーションを実行します：

```bash
# Supabase CLIをインストール
npm install -g supabase

# ログイン
supabase login

# プロジェクトをリンク
npx supabase link --project-ref your-project-ref

# マイグレーションを適用
npx supabase db push
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## アプリケーションアーキテクチャ

このプロジェクトは以下の層構造に従って設計されています。

```
クライアント層（UI）
    ↓↑
フック層（データ取得・状態管理）
    ↓↑
サーバーアクション層（API）
    ↓↑
サービス層（ビジネスロジック）
    ↓↑
リポジトリ層（データアクセス）
```

### 各層の役割と詳細

#### クライアント層 (`src/app`, `src/components`)

- **ページコンポーネント**: `src/app` ディレクトリ下にルーティングに基づいたページを配置
- **UI コンポーネント**: `src/components` ディレクトリに再利用可能な UI コンポーネントを配置
- **フィーチャーコンポーネント**: `src/components/features` に機能単位のコンポーネントを配置

#### フック層 (`src/hooks`)

- クライアントコンポーネントからサーバーアクションを呼び出すためのカスタムフックを提供
- LINE LIFF や認証などの機能を抽象化

#### サーバーアクション層 (`src/server/handler`)

- クライアント側からの要求を受け取り、適切なサービスを呼び出す
- Next.js の Server Actions を活用し、クライアント-サーバー間のデータ通信を担当

#### サービス層 (`src/server/services`)

- ビジネスロジックを実装
- 複数のリポジトリを組み合わせた処理や、バリデーションなどを担当
- データの加工や変換を行う

#### リポジトリ層 (`src/server/repositories`)

- データストレージ（Supabase など）とのやり取りを担当
- CRUD 操作を実装
- データベースモデルとアプリケーションモデル間の変換を行う

### データフロー

1. ユーザーが UI で操作を行う（Todo の追加など）
2. クライアントコンポーネントがサーバーアクションを呼び出す
3. サーバーアクションが適切なサービスメソッドを実行
4. サービスがビジネスロジックを適用し、リポジトリを通じてデータを保存/取得
5. 結果がサーバーアクションを経由してクライアントに返される
6. UI が更新される

### 認証フロー

1. `useLiff` フックが LIFF SDK を初期化
2. ユーザーが LINE でログイン
3. LIFF SDK からユーザープロファイル情報を取得
4. ユーザー ID をクッキーに保存
5. サーバーアクションがクッキーからユーザー ID を取得し、それをサービス層に渡す
6. サービス層がユーザー固有のデータ操作を行う

### ファイル構成まとめ

- `src/app`: ページコンポーネント (Next.js ルーティング)
- `src/components`: UI コンポーネント
- `src/hooks`: カスタムフック
- `src/server/handler`: サーバーアクション
- `src/server/services`: ビジネスロジック
- `src/server/repositories`: データアクセス
- `src/types`: 型定義
- `src/lib`: ユーティリティ関数



<!-- リセットコマンド -->
supabase db reset --linked
npx supabase db push




けっさい
env
最低限のDB