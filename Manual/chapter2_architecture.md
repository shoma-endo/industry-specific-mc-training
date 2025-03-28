# 第1章：アーキテクチャーについて

## アプリケーション概要

LIFF-Templateは、LINEユーザー向けのAIチャットアプリケーションです。ユーザーはLINEアカウントでログインし、AIアシスタントとの対話を行うことができます。また、有料サブスクリプションを通じて高度な機能にアクセスすることも可能です。

## アーキテクチャ設計

このプロジェクトは、クリーンアーキテクチャの考え方に基づく階層型アーキテクチャを採用しています。各レイヤーは明確な責任を持ち、依存関係が内側から外側へ向かう方向に制限されています。

### 主要なレイヤー

1. **クライアント層（Presentation Layer）**
   - Reactコンポーネント（`/src/app/`および`/src/components/`）
   - ユーザーインターフェースとユーザーインタラクションを担当
   - 例: ChatPage, LiffProvider, UIコンポーネント

2. **フック層（Hooks Layer）**
   - Reactカスタムフック（`/src/hooks/`）
   - UIとサービス層の橋渡し役
   - 例: useLiff, useSubscription, useStripeCheckout

3. **サーバーアクション層（Server Actions Layer）**
   - Next.js Server Actions（`/src/server/handler/actions/`）
   - クライアントからサーバーへのリクエスト処理
   - バリデーションとサービス層の呼び出し
   - 例: chat.actions.ts, subscription.actions.ts, login.actions.ts

4. **サービス層（Service Layer）**
   - ビジネスロジック（`/src/server/services/`）
   - 複数のリポジトリやAPIの連携
   - 例: chatService, userService, openAiService, stripeService

5. **リポジトリ層（Repository Layer）**
   - データアクセス（`/src/server/services/`内のリポジトリクラス）
   - データベースとのやり取りを抽象化
   - 例: chatRepository, userRepository

6. **外部サービス抽象層（External Services Layer）**
   - 外部APIとの統合（`/src/server/services/`内の特定のサービスクラス）
   - 外部依存を抽象化
   - 例: supabaseService, lineAuthService

### 型システム

アプリケーション全体で型安全性を確保するため、以下のような型定義を使用しています：

- ドメインモデル（`/src/types/`）
  - データベースモデルとアプリケーションモデルの橋渡し
  - 例: `chat.ts`, `user.ts`

- 変換関数
  - データベース形式（スネークケース）とアプリケーション形式（キャメルケース）の変換
  - 例: `toChatMessage`, `toDbChatMessage`

### データフロー

1. ユーザーがUIでアクションを実行（例: メッセージ送信）
2. クライアントコンポーネントがServer Actionを呼び出し
3. Server Actionがリクエストを検証しサービス層へ渡す
4. サービス層がビジネスロジックを実行（複数のリポジトリやサービスを連携）
5. リポジトリ層がデータベースにアクセス
6. 結果が逆の順序でクライアントに戻る

### 認証フロー

1. ユーザーがLINEアカウントでログイン
2. LIFF SDKがアクセストークンを取得
3. アクセストークンがServer Actionに送信される
4. lineAuthServiceがLINE Platformでトークンを検証しプロフィール取得
5. userServiceがユーザー情報をデータベースに保存/更新
6. セッションが確立され、ユーザーに特定の機能へのアクセスが許可される

### サブスクリプションフロー

1. ユーザーが有料機能にアクセスしようとする
2. サーバーがユーザーのサブスクリプションステータスを確認
3. 未サブスクライブの場合、決済ページへのリダイレクト
4. Stripeでの支払い完了後、ユーザーレコードが更新される
5. ユーザーが有料機能にアクセスできるようになる

### チャット機能のフロー

1. ユーザーがメッセージを入力し送信
2. クライアントがServer Actionを呼び出し
3. サブスクリプション状態の確認
4. chatServiceがOpenAI APIを使用して応答を生成
5. 会話履歴がデータベースに保存
6. 応答がクライアントに返され、UIに表示

## プロジェクトのファイル構造

LIFF-Templateプロジェクトのファイル構造は、機能とレイヤーに基づいて整理されています：

```
/src
  /app                   # Next.jsアプリケーションルートとレイアウト
    /chat                # チャットページ
      /page.tsx          # チャットUIコンポーネント
    /mypage              # マイページ（ユーザー情報、サブスクリプション管理）
      /page.tsx          # マイページUIコンポーネント
    /globals.css         # グローバルスタイルとTailwind設定
    /layout.tsx          # ルートレイアウトコンポーネント
    /page.tsx            # ホームページコンポーネント（エントリーポイント）
  
  /components            # UIコンポーネント
    /LiffProvider.tsx    # LIFFコンテキストプロバイダー
    /ui                  # 再利用可能なUIコンポーネント
      /navigation-menu.tsx # ナビゲーションメニューコンポーネント
      /sheet.tsx         # シート（ダイアログ）コンポーネント
      /textarea.tsx      # テキストエリアコンポーネント
  
  /hooks                 # カスタムReact Hooks
    /useLiff.ts          # LIFF機能のカスタムフック
  
  /server                # サーバーサイドコード
    /handler             # リクエストハンドラー
      /actions           # サーバーアクション
        /chat.actions.ts # チャット関連のアクション
        /login.actions.ts # ログイン関連のアクション
        /subscription.actions.ts # サブスクリプション関連のアクション
    /services            # サービス層
      /chatRepository.ts # チャットデータアクセス
      /chatService.ts    # チャットビジネスロジック
      /lineAuthService.ts # LINE認証サービス
      /openAiService.ts  # OpenAI APIサービス
      /stripeService.ts  # Stripe決済サービス
      /supabaseService.ts # Supabaseサービス
      /userRepository.ts # ユーザーデータアクセス
      /userService.ts    # ユーザー管理ビジネスロジック
  
  /types                 # 型定義
    /chat.ts             # チャット関連の型定義
    /chatResponse.ts     # チャットレスポンスの型定義
    /user.ts             # ユーザー情報の型定義
  
  /env.ts                # 環境変数の型安全な定義

/supabase               # Supabase関連ファイル
  /migrations           # データベースマイグレーション
    /20240327000001_create_chat_tables.sql # チャットテーブル作成
    /20250327000000_create_users_table.sql # ユーザーテーブル作成
```

## データベース設計

アプリケーションは以下の主要なテーブルを使用しています：

1. **users**
   - ユーザー情報の管理（LINE情報、Stripe顧客ID、サブスクリプション情報）
   - Row Level Security (RLS)によるアクセス制御

2. **chat_sessions**
   - ユーザーごとのチャットセッション管理
   - セッションメタデータ（作成日時、タイトル、モデル情報）

3. **chat_messages**
   - チャットセッション内のメッセージ履歴
   - メッセージの内容、役割（ユーザー/アシスタント）、タイムスタンプ

## リポジトリパターンの実装

データアクセスは、リポジトリパターンを使用して抽象化されています：

1. **UserRepository**
   - ユーザー情報のCRUD操作
   - LINE情報とStripe情報の関連付け

2. **ChatRepository**
   - チャットセッションとメッセージの管理
   - 会話履歴の保存と取得

これらのリポジトリは、Supabaseクライアントを使用してデータベースと通信し、型安全な方法でデータを変換します。

## アーキテクチャの利点

1. **関心の分離**: 各レイヤーが特定の責任を持ち、コードの理解と保守が容易
2. **テスト容易性**: 各レイヤーを独立してテスト可能
3. **スケーラビリティ**: 新機能や外部サービスの追加が容易
4. **技術的柔軟性**: 外部サービスの実装を変更しても内部レイヤーへの影響が最小限
5. **チーム開発の効率化**: 明確な責任分担により並行開発が容易

このアーキテクチャにより、アプリケーションは保守性、拡張性、および品質の高い実装を実現しています。
