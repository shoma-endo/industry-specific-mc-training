# 第5章 stripeのセットアップ

## 5.1 Stripeとは

Stripeは、オンライン決済処理のためのプラットフォームで、サブスクリプション管理、ワンタイム決済、顧客管理などの機能を提供しています。LIFF-Templateプロジェクトでは、Stripeを使用してAIチャット機能へのアクセスを制限するサブスクリプション管理を実装しています。

Stripeの主な特徴：
- 安全な決済処理
- サブスクリプション管理
- 顧客管理
- 請求書発行
- 複数通貨対応
- 豊富なAPI
- 開発者フレンドリーなドキュメント

## 5.2 Stripeアカウントの作成

### 5.2.1 アカウント登録

1. [Stripeのウェブサイト](https://stripe.com/)にアクセスします。
2. 「今すぐ始める」または「Start now」ボタンをクリックします。
3. メールアドレス、名前、パスワードを入力して登録します。
4. 確認メールを受け取り、アカウントを有効化します。

### 5.2.2 アカウント設定

1. ダッシュボードにログインします。
2. 「設定」→「アカウント情報」で、ビジネス情報を入力します。
3. 「設定」→「支払い方法」で、支払い方法を設定します。
4. 「設定」→「チーム」で、必要に応じてチームメンバーを招待します。

## 5.3 APIキーの取得

### 5.3.1 テストモードと本番モード

Stripeには、テストモードと本番モードの2つの動作モードがあります：

- **テストモード**：実際の決済は発生せず、テストカード情報を使用してテストできます。
- **本番モード**：実際の決済が発生します。本番環境で使用する前に、アカウント情報の確認が必要です。

### 5.3.2 APIキーの取得方法

1. Stripeダッシュボードで「開発者」→「APIキー」を選択します。
2. テストモードまたは本番モードを選択します。
3. 以下のAPIキーが表示されます：
   - **公開可能キー（Publishable Key）**：クライアントサイドで使用
   - **シークレットキー（Secret Key）**：サーバーサイドでのみ使用
   - **Webhook署名シークレット**：Webhookの検証に使用

### 5.3.3 環境変数の設定

LIFF-Templateプロジェクトでは、Stripe APIキーを環境変数として設定します：

1. プロジェクトのルートディレクトリに`.env.local`ファイルを作成または編集します。
2. 以下の行を追加します：
   ```
   STRIPE_SECRET_KEY=sk_test_your_secret_key
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   ```
3. 各キーを実際の値に置き換えます。

これらの環境変数は、`src/env.ts`ファイルで型安全に定義されています：

```typescript
export const env = createEnv({
  server: {
    STRIPE_SECRET_KEY: z.string().min(1),
    STRIPE_WEBHOOK_SECRET: z.string().min(1),
    // ...
  },
  client: {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
    // ...
  },
  // ...
});
```

## 5.4 商品とプランの設定

### 5.4.1 商品の作成

1. Stripeダッシュボードで「商品」→「追加」を選択します。
2. 以下の情報を入力します：
   - 商品名（例：「AIチャットプレミアム」）
   - 説明
   - 画像（オプション）
3. 「保存」ボタンをクリックします。

### 5.4.2 価格プランの作成

1. 作成した商品の詳細ページで「価格を追加」をクリックします。
2. 以下の情報を入力します：
   - 価格（例：「1,000円」）
   - 請求頻度（例：「月額」）
   - 通貨（例：「JPY」）
3. 「保存」ボタンをクリックします。

### 5.4.3 プランIDの取得

作成した価格プランのIDを取得します：

1. 価格プランの詳細ページで「APIキー」タブを選択します。
2. 「価格ID」（例：`price_1234567890abcdef`）をメモします。

このIDは、サブスクリプションチェックアウトセッションの作成時に使用します。

## 5.5 Stripeサービスの実装

LIFF-Templateプロジェクトでは、`stripeService.ts`ファイルでStripe APIとの通信を管理しています：

```typescript
import Stripe from 'stripe';
import { env } from '@/env';

export class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY);
  }

  // 顧客作成
  async createCustomer(userId: string, name: string) {
    try {
      const customer = await this.stripe.customers.create({
        metadata: { userId },
        name,
      });
      return customer.id;
    } catch (error) {
      console.error('Stripe customer creation failed:', error);
      throw new Error('顧客情報の作成に失敗しました');
    }
  }

  // サブスクリプション取得
  async getActiveSubscription(customerId: string) {
    try {
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 1,
      });
      return subscriptions.data.length > 0 ? subscriptions.data[0] : null;
    } catch (error) {
      console.error('Stripe subscription retrieval failed:', error);
      throw new Error('サブスクリプション情報の取得に失敗しました');
    }
  }

  // チェックアウトセッション作成
  async createSubscriptionCheckout({
    priceId,
    customerId,
    successUrl,
    cancelUrl,
    metadata = {},
  }: {
    priceId: string;
    customerId: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }) {
    try {
      const session = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer: customerId,
        metadata,
      });
      return { url: session.url, sessionId: session.id };
    } catch (error) {
      console.error('Stripe checkout session creation failed:', error);
      throw new Error('決済セッションの作成に失敗しました');
    }
  }
}
```

## 5.6 サブスクリプションフロー

### 5.6.1 サブスクリプションの作成フロー

1. ユーザーがLINEでログインします。
2. ユーザー情報がSupabaseに保存されます。
3. ユーザーがサブスクリプション購入ボタンをクリックします。
4. サーバーアクションが呼び出され、以下の処理が行われます：
   - ユーザーがStripe顧客として登録されていない場合、新規作成します。
   - Stripeチェックアウトセッションを作成します。
   - チェックアウトセッションURLをクライアントに返します。
5. ユーザーがStripeチェックアウトページにリダイレクトされます。
6. ユーザーが支払い情報を入力し、サブスクリプションを購入します。
7. 成功すると、成功URLにリダイレクトされます。
8. WebhookがStripeからのイベントを受信し、ユーザーのサブスクリプション情報を更新します。

### 5.6.2 サブスクリプションの確認フロー

1. ユーザーがAIチャット機能にアクセスしようとします。
2. サーバーアクションが呼び出され、以下の処理が行われます：
   - ユーザー情報をLIFFトークンから取得します。
   - ユーザーのStripe顧客IDを取得します。
   - アクティブなサブスクリプションがあるか確認します。
3. サブスクリプションがある場合、AIチャット機能へのアクセスが許可されます。
4. サブスクリプションがない場合、エラーメッセージが表示され、サブスクリプション購入ページへのリンクが表示されます。

### 5.6.3 サブスクリプションの管理フロー

1. ユーザーがサブスクリプション管理ページにアクセスします。
2. サーバーアクションが呼び出され、以下の処理が行われます：
   - ユーザー情報をLIFFトークンから取得します。
   - ユーザーのStripe顧客IDを取得します。
   - Stripe顧客ポータルセッションを作成します。
3. ユーザーがStripe顧客ポータルにリダイレクトされます。
4. ユーザーは以下の操作を行うことができます：
   - 支払い方法の更新
   - サブスクリプションのキャンセル
   - 請求履歴の確認
5. 操作が完了すると、アプリケーションにリダイレクトされます。

## 5.7 Webhookの設定

### 5.7.1 Webhookエンドポイントの作成

LIFF-Templateプロジェクトでは、Stripeからのイベント通知を受け取るためのWebhookエンドポイントを実装しています：

```typescript
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { env } from '@/env';
import { userRepository } from '@/server/services/userRepository';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature') as string;

    // イベントの検証
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );

    // イベントタイプに基づいて処理
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // サブスクリプション情報の更新
        if (session.customer && session.subscription) {
          await userRepository.updateStripeInfo(
            session.customer as string,
            session.subscription as string
          );
        }
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        
        // サブスクリプション削除時の処理
        if (subscription.customer) {
          await userRepository.removeSubscription(
            subscription.customer as string
          );
        }
        break;
      }
      
      // その他のイベントタイプの処理
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 400 }
    );
  }
}
```

### 5.7.2 Webhookの登録

1. Stripeダッシュボードで「開発者」→「Webhook」を選択します。
2. 「エンドポイントを追加」ボタンをクリックします。
3. 以下の情報を入力します：
   - エンドポイントURL：`https://your-domain.com/api/webhooks/stripe`
   - イベントを選択：
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
4. 「エンドポイントを追加」ボタンをクリックします。
5. 署名シークレットをメモし、環境変数`STRIPE_WEBHOOK_SECRET`に設定します。

### 5.7.3 Webhookのテスト

1. Stripeダッシュボードで「開発者」→「Webhook」を選択します。
2. 登録したWebhookエンドポイントを選択します。
3. 「イベントを送信」ボタンをクリックします。
4. テストするイベントタイプを選択し、「送信」ボタンをクリックします。
5. アプリケーションのログでWebhookの受信と処理を確認します。

## 5.8 テストカード情報

Stripeのテストモードでは、以下のテストカード情報を使用できます：

- **カード番号**：`4242 4242 4242 4242`
- **有効期限**：将来の任意の日付（例：12/25）
- **CVC**：任意の3桁の数字（例：123）
- **郵便番号**：任意の5桁または6桁の数字（例：12345）

その他のテストケース：

- **支払い失敗**：`4000 0000 0000 0002`
- **3Dセキュア認証必要**：`4000 0000 0000 3220`
- **住所確認失敗**：`4000 0000 0000 0010`

## 5.9 本番環境への移行

### 5.9.1 アカウント情報の確認

本番環境でStripeを使用する前に、以下の情報を確認してください：

1. ビジネス情報（会社名、住所、電話番号など）
2. 銀行口座情報
3. 本人確認書類

### 5.9.2 本番APIキーの使用

1. Stripeダッシュボードで「開発者」→「APIキー」を選択します。
2. 「本番」モードに切り替えます。
3. 本番用の公開可能キーとシークレットキーを取得します。
4. 環境変数を更新します：
   ```
   STRIPE_SECRET_KEY=sk_live_your_secret_key
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_publishable_key
   STRIPE_WEBHOOK_SECRET=whsec_your_live_webhook_secret
   ```

### 5.9.3 本番Webhookの設定

1. 本番モードでWebhookエンドポイントを登録します。
2. 本番用の署名シークレットを環境変数に設定します。

## 5.10 セキュリティ考慮事項

### 5.10.1 APIキーの保護

- シークレットキーは絶対に公開しないでください。
- シークレットキーはサーバーサイドでのみ使用してください。
- 環境変数を使用してAPIキーを管理してください。

### 5.10.2 Webhook署名の検証

Webhookリクエストの署名を検証して、リクエストがStripeから送信されたものであることを確認してください：

```typescript
const event = stripe.webhooks.constructEvent(
  body,
  signature,
  webhookSecret
);
```

### 5.10.3 PCI DSSコンプライアンス

Stripeを使用することで、PCI DSSコンプライアンスの負担を軽減できますが、以下の点に注意してください：

- カード情報をアプリケーションサーバーに保存しないでください。
- Stripeの公式SDKとチェックアウトページを使用してください。
- 定期的にセキュリティ監査を実施してください。

## 5.11 トラブルシューティング

### 5.11.1 決済エラー

決済エラーが発生した場合の対処法：

1. Stripeダッシュボードで「支払い」→「支払い」を選択し、エラーの詳細を確認します。
2. エラーコードに基づいて、適切な対応を行います：
   - `card_declined`：別のカードを試すようユーザーに促します。
   - `expired_card`：有効期限が切れていないカードを使用するようユーザーに促します。
   - `incorrect_cvc`：正しいCVCを入力するようユーザーに促します。

### 5.11.2 Webhookエラー

Webhookエラーが発生した場合の対処法：

1. Stripeダッシュボードで「開発者」→「Webhook」を選択し、エラーの詳細を確認します。
2. 署名シークレットが正しいか確認します。
3. エンドポイントURLが正しいか確認します。
4. サーバーログでエラーメッセージを確認します。

### 5.11.3 サブスクリプション管理の問題

サブスクリプション管理に問題がある場合の対処法：

1. ユーザーのStripe顧客IDとサブスクリプションIDが正しくデータベースに保存されているか確認します。
2. Stripeダッシュボードで顧客とサブスクリプションの状態を確認します。
3. Webhookが正しく設定され、イベントを受信しているか確認します。

## 5.12 まとめ

Stripeは、LIFF-Templateプロジェクトでサブスクリプション管理と決済処理を実現するための重要なコンポーネントです。APIキーの取得、商品とプランの設定、サービスの実装、Webhookの設定など、適切なセットアップを行うことで、安全で信頼性の高い決済システムを構築できます。

テストモードでの十分なテストを行い、本番環境への移行時にはセキュリティ考慮事項に注意することが重要です。また、トラブルシューティングの知識を持つことで、問題が発生した場合に迅速に対応できます。
