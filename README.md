This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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