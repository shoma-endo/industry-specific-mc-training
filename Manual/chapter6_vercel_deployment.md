# 第6章 vercelにデプロイ

## 6.1 Vercelとは

Vercelは、フロントエンドアプリケーションのためのクラウドプラットフォームで、特にNext.jsアプリケーションのデプロイに最適化されています。GitHubなどのリポジトリと連携し、継続的デプロイメント（CD）を実現します。

Vercelの主な特徴：
- ゼロコンフィグデプロイ
- グローバルCDN
- 自動HTTPS
- プレビューデプロイメント
- サーバーレス関数
- 環境変数管理
- ドメイン管理

## 6.2 Vercelアカウントの作成

### 6.2.1 アカウント登録

1. [Vercelのウェブサイト](https://vercel.com/)にアクセスします。
2. 「Sign Up」ボタンをクリックします。
3. GitHubアカウント、GitLabアカウント、Bitbucketアカウント、またはメールアドレスでサインアップします。
4. 必要に応じて、追加情報を入力します。

### 6.2.2 チームの作成（オプション）

1. ダッシュボードで「New Team」をクリックします。
2. チーム名を入力し、「Create Team」をクリックします。
3. チームメンバーを招待します（オプション）。

## 6.3 GitHubリポジトリの準備

### 6.3.1 リポジトリの作成

1. GitHubで新しいリポジトリを作成します。
2. リポジトリ名、説明、可視性（パブリックまたはプライベート）を設定します。
3. 「Create repository」ボタンをクリックします。

### 6.3.2 コードのプッシュ

1. ローカルプロジェクトディレクトリで以下のコマンドを実行します：
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/username/repository.git
   git push -u origin main
   ```
2. `username`と`repository`を実際のユーザー名とリポジトリ名に置き換えます。

## 6.4 Vercelへのデプロイ

### 6.4.1 新規プロジェクトの作成

1. Vercelダッシュボードで「New Project」ボタンをクリックします。
2. GitHubアカウントを連携している場合、リポジトリの一覧が表示されます。
3. LIFF-Templateプロジェクトのリポジトリを選択します。

### 6.4.2 プロジェクト設定

1. プロジェクト名を入力します（デフォルトではリポジトリ名）。
2. フレームワークプリセットとして「Next.js」が自動的に選択されていることを確認します。
3. ビルドコマンドとアウトプットディレクトリが正しく設定されていることを確認します：
   - ビルドコマンド：`next build`
   - アウトプットディレクトリ：`.next`

### 6.4.3 環境変数の設定

1. 「Environment Variables」セクションで、必要な環境変数を追加します：
   ```
   NEXT_PUBLIC_LIFF_ID=your_liff_id
   NEXT_PUBLIC_LIFF_CHANNEL_ID=your_channel_id
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   OPENAI_API_KEY=your_openai_api_key
   STRIPE_SECRET_KEY=your_stripe_secret_key
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
   STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
   ```
2. 各環境変数の値を実際の値に置き換えます。

### 6.4.4 デプロイの実行

1. すべての設定を確認し、「Deploy」ボタンをクリックします。
2. デプロイが完了するまで待ちます（通常は数分）。
3. デプロイが成功すると、プロジェクトのURLが表示されます（例：`https://your-project.vercel.app`）。

## 6.5 カスタムドメインの設定

### 6.5.1 ドメインの追加

1. プロジェクトのダッシュボードで「Settings」→「Domains」を選択します。
2. 「Add」ボタンをクリックします。
3. カスタムドメイン（例：`www.your-domain.com`）を入力し、「Add」ボタンをクリックします。

### 6.5.2 DNSの設定

Vercelは、以下の2つの方法でドメインを設定できます：

1. **Vercelにドメインを移管する方法**：
   - 「Transfer in your domain to Vercel」を選択します。
   - 指示に従って、ドメインをVercelに移管します。

2. **既存のDNSプロバイダーを使用する方法**：
   - 「Configure nameservers」を選択します。
   - 表示されるDNSレコード（CNAMEまたはA/AAA）を、ドメインのDNSプロバイダーに追加します。

### 6.5.3 SSL証明書の設定

Vercelは、カスタムドメインに対して自動的にSSL証明書を発行します。特別な設定は必要ありません。

## 6.6 継続的デプロイメント（CD）

### 6.6.1 自動デプロイの設定

Vercelは、GitHubリポジトリと連携することで、コードの変更が検出されると自動的にデプロイを実行します：

1. プロジェクトのダッシュボードで「Settings」→「Git」を選択します。
2. 「Production Branch」セクションで、本番環境用のブランチ（通常は`main`または`master`）を設定します。
3. 「Ignored Build Step」セクションで、必要に応じてビルドをスキップする条件を設定します。

### 6.6.2 プレビューデプロイメント

Vercelは、プルリクエストごとにプレビューデプロイメントを自動的に作成します：

1. GitHubでプルリクエストを作成します。
2. Vercelが自動的にプレビューデプロイメントを作成します。
3. プルリクエストのコメントに、プレビューURLが表示されます。
4. プレビューURLにアクセスして、変更内容を確認できます。

## 6.7 環境変数の管理

### 6.7.1 環境ごとの変数設定

Vercelでは、本番環境、プレビュー環境、開発環境ごとに異なる環境変数を設定できます：

1. プロジェクトのダッシュボードで「Settings」→「Environment Variables」を選択します。
2. 環境変数を追加する際に、適用する環境（Production、Preview、Development）を選択します。
3. 「Save」ボタンをクリックして、変更を保存します。

### 6.7.2 環境変数のローテーション

セキュリティのために、定期的に環境変数（特にAPIキーなど）をローテーションすることをお勧めします：

1. 新しいAPIキーを発行します。
2. Vercelの環境変数を更新します。
3. 古いAPIキーを無効化します。

## 6.8 パフォーマンスの最適化

### 6.8.1 ビルド出力の最適化

Next.jsアプリケーションのビルド出力を最適化するために、`next.config.ts`ファイルで以下の設定を行います：

```typescript
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['profile.line-scdn.net'],
  },
  experimental: {
    serverActions: true,
  },
};

export default nextConfig;
```

### 6.8.2 キャッシュの設定

Vercelでは、ビルドキャッシュとエッジキャッシュを設定できます：

1. **ビルドキャッシュ**：
   - `.vercelignore`ファイルを作成して、キャッシュから除外するファイルを指定します。
   - `package.json`の`dependencies`と`devDependencies`を適切に分離します。

2. **エッジキャッシュ**：
   - Next.jsの`getStaticProps`と`getServerSideProps`を使用して、キャッシュ戦略を実装します。
   - Vercelのエッジキャッシュを活用するために、適切なキャッシュヘッダーを設定します。

## 6.9 モニタリングとログ

### 6.9.1 デプロイメントのモニタリング

Vercelダッシュボードでは、以下の情報をモニタリングできます：

1. デプロイメントのステータス
2. ビルドログ
3. サーバーレス関数の実行状況
4. エラーと警告

### 6.9.2 アナリティクス

Vercelのアナリティクス機能を使用して、以下の情報を収集できます：

1. ページビュー
2. リアルタイムユーザー
3. 地理的分布
4. デバイスとブラウザの情報

これらの情報は、「Analytics」タブで確認できます。

## 6.10 トラブルシューティング

### 6.10.1 ビルドエラー

ビルドエラーが発生した場合の対処法：

1. ビルドログを確認して、エラーの原因を特定します。
2. ローカル環境で`next build`コマンドを実行して、同じエラーが再現するか確認します。
3. 依存関係の問題がある場合は、`package.json`ファイルを確認し、必要に応じて更新します。
4. 環境変数が正しく設定されているか確認します。

### 6.10.2 ランタイムエラー

ランタイムエラーが発生した場合の対処法：

1. ブラウザのコンソールでエラーメッセージを確認します。
2. Vercelのログで詳細なエラー情報を確認します。
3. ローカル環境で問題を再現し、デバッグします。
4. 必要に応じて、Sentryなどのエラー追跡ツールを導入します。

### 6.10.3 デプロイメントのロールバック

問題のあるデプロイメントをロールバックする方法：

1. プロジェクトのダッシュボードで「Deployments」タブを選択します。
2. 以前の正常なデプロイメントを見つけます。
3. そのデプロイメントの「...」メニューをクリックし、「Promote to Production」を選択します。

## 6.11 LIFF-Template固有の設定

### 6.11.1 LIFF URLの設定

LINE LIFFアプリケーションのエンドポイントURLを、VercelのデプロイメントURLに更新します：

1. [LINEデベロッパーコンソール](https://developers.line.biz/console/)にアクセスします。
2. LIFFアプリを選択します。
3. 「LIFF」タブで、エンドポイントURLを編集します。
4. VercelのデプロイメントURL（例：`https://your-project.vercel.app`）を入力します。
5. 「更新」ボタンをクリックします。

### 6.11.2 Webhook URLの設定

Stripe WebhookのURLを、VercelのデプロイメントURLに更新します：

1. [Stripeダッシュボード](https://dashboard.stripe.com/)にアクセスします。
2. 「開発者」→「Webhook」を選択します。
3. Webhookエンドポイントを編集します。
4. エンドポイントURLを`https://your-project.vercel.app/api/webhooks/stripe`に更新します。
5. 「保存」ボタンをクリックします。

## 6.12 まとめ

Vercelは、Next.jsアプリケーションのデプロイに最適化されたプラットフォームで、LIFF-Templateプロジェクトを簡単にデプロイできます。GitHubリポジトリと連携することで、継続的デプロイメント（CD）を実現し、開発ワークフローを効率化できます。

デプロイ時には、環境変数の設定、カスタムドメインの設定、パフォーマンスの最適化などに注意することが重要です。また、LIFF URLやWebhook URLなど、LIFF-Template固有の設定も忘れずに行いましょう。

Vercelのモニタリング機能とログ機能を活用することで、アプリケーションの状態を常に把握し、問題が発生した場合は迅速に対応できます。
