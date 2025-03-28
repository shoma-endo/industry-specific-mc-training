# 第４章 supabaseのセットアップ

## 4.1 Supabaseとは

Supabaseは、オープンソースのFirebase代替サービスで、PostgreSQLデータベースを基盤としています。リアルタイムデータベース、認証、ストレージ、サーバーレス関数などの機能を提供し、モダンなウェブアプリケーション開発を効率化します。

Supabaseの主な特徴：
- PostgreSQLデータベース
- リアルタイムサブスクリプション
- 認証システム
- ストレージ
- Row Level Security（RLS）
- REST APIとGraphQL API
- サーバーレス関数

## 4.2 Supabaseアカウントの作成とプロジェクトのセットアップ

### 4.2.1 アカウント作成

1. [Supabaseのウェブサイト](https://supabase.com/)にアクセスします。
2. 「Start your project」ボタンをクリックします。
3. GitHubアカウントでログインするか、メールアドレスとパスワードで新規登録します。

### 4.2.2 新規プロジェクトの作成

1. ダッシュボードで「New Project」ボタンをクリックします。
2. 以下の情報を入力します：
   - プロジェクト名
   - データベースパスワード
   - リージョン（アプリケーションのユーザーに近いリージョンを選択）
   - 料金プラン（無料プランまたは有料プラン）
3. 「Create new project」ボタンをクリックします。
4. プロジェクトの作成には数分かかります。

### 4.2.3 APIキーの取得

プロジェクトが作成されたら、APIキーを取得します：

1. プロジェクトのダッシュボードで「Settings」→「API」を選択します。
2. 以下の情報をメモします：
   - Project URL
   - API Key（`anon`キーと`service_role`キー）

これらの情報は、アプリケーションからSupabaseに接続するために必要です。

## 4.3 環境変数の設定

LIFF-Templateプロジェクトでは、Supabase接続情報を環境変数として設定します：

1. プロジェクトのルートディレクトリに`.env.local`ファイルを作成します（既に存在する場合は編集します）。
2. 以下の行を追加します：
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```
3. `your_project_url`、`your_anon_key`、`your_service_role_key`を実際の値に置き換えます。

これらの環境変数は、`src/env.ts`ファイルで型安全に定義されています：

```typescript
export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    // ...
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    // ...
  },
  // ...
});
```

## 4.4 データベースのセットアップ

LIFF-Templateプロジェクトでは、マイグレーションファイルを使用してデータベーススキーマを定義しています。

### 4.4.1 マイグレーションファイルの概要

`supabase/migrations`ディレクトリには、以下のマイグレーションファイルが含まれています：

1. `20240322_create_todos.sql`: Todosテーブルの作成とRLSポリシーの設定
2. `20250322190944_fix_todos_table.sql`: Todosテーブルの修正

### 4.4.2 Todosテーブルの作成

`20240322_create_todos.sql`ファイルには、Todosテーブルの作成とRLSポリシーの設定が含まれています：

```sql
-- todos テーブルの作成
CREATE TABLE IF NOT EXISTS todos (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  user_id TEXT, -- LINEのユーザーID
  created_at BIGINT NOT NULL
);

-- RLSポリシーの設定
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーが自分のデータにアクセスできるポリシー
CREATE POLICY "認証済みユーザーのtodos読み取り" ON todos
  FOR SELECT TO authenticated USING (user_id = auth.uid()::TEXT);

-- 匿名アクセス用の許可ポリシー（開発環境用）
CREATE POLICY "匿名アクセス許可" ON todos
  FOR ALL USING (true);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS todos_user_id_idx ON todos (user_id);
CREATE INDEX IF NOT EXISTS todos_created_at_idx ON todos (created_at);
```

このマイグレーションファイルは、以下の操作を行います：
- Todosテーブルの作成（id、text、completed、user_id、created_atカラム）
- Row Level Security（RLS）の有効化
- 認証済みユーザーが自分のデータにアクセスできるポリシーの作成
- 開発環境用の匿名アクセス許可ポリシーの作成
- インデックスの作成（user_idとcreated_atカラム）

### 4.4.3 マイグレーションの実行

Supabaseプロジェクトでマイグレーションを実行するには、以下の方法があります：

1. **Supabase CLIを使用する方法**：
   ```bash
   supabase db push
   ```

2. **SQLエディタを使用する方法**：
   - Supabaseダッシュボードで「SQL Editor」を選択
   - マイグレーションファイルの内容をコピー＆ペースト
   - 「Run」ボタンをクリック

## 4.5 Row Level Security（RLS）の設定

Supabaseでは、Row Level Security（RLS）を使用して、ユーザーごとにデータアクセスを制限できます。LIFF-Templateプロジェクトでは、以下のRLSポリシーを設定しています：

### 4.5.1 認証済みユーザーのデータアクセスポリシー

```sql
CREATE POLICY "認証済みユーザーのtodos読み取り" ON todos
  FOR SELECT TO authenticated USING (user_id = auth.uid()::TEXT);
```

このポリシーは、認証済みユーザーが自分のデータ（user_idが自分のIDと一致するデータ）のみを読み取れるようにします。

### 4.5.2 開発環境用の匿名アクセスポリシー

```sql
CREATE POLICY "匿名アクセス許可" ON todos
  FOR ALL USING (true);
```

このポリシーは、開発環境で匿名ユーザーを含むすべてのユーザーがすべてのデータにアクセスできるようにします。本番環境では、このポリシーを削除または無効化することをお勧めします。

### 4.5.3 RLSポリシーの管理

Supabaseダッシュボードで、RLSポリシーを管理できます：

1. 「Authentication」→「Policies」を選択
2. テーブルを選択
3. 既存のポリシーを編集または新しいポリシーを追加

## 4.6 Supabaseクライアントの初期化

LIFF-Templateプロジェクトでは、`supabaseService.ts`ファイルでSupabaseクライアントを初期化しています：

```typescript
import { createClient } from '@supabase/supabase-js';
import { env } from '@/env';

export class SupabaseService {
  private supabase;

  constructor() {
    this.supabase = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  // Supabaseクライアントを取得
  getClient() {
    return this.supabase;
  }
}
```

このサービスは、環境変数からSupabase URLとサービスロールキーを取得し、Supabaseクライアントを初期化します。サービスロールキーは、サーバーサイドでのみ使用され、RLSポリシーをバイパスする権限を持ちます。

## 4.7 データ変換ユーティリティ

LIFF-Templateプロジェクトでは、データベースのスネークケース（snake_case）とアプリケーションのキャメルケース（camelCase）の間でデータを変換するユーティリティ関数を提供しています：

```typescript
// スネークケースからキャメルケースへの変換
export function snakeToCamel<T>(obj: Record<string, any>): T {
  const newObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    newObj[newKey] = value;
  }
  return newObj as T;
}

// キャメルケースからスネークケースへの変換
export function camelToSnake<T>(obj: Record<string, any>): T {
  const newObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    newObj[newKey] = value;
  }
  return newObj as T;
}

// データベースレコードからTodoItemへの変換
export function toTodoItem(record: Record<string, any>): TodoItem {
  return snakeToCamel<TodoItem>(record);
}

// TodoItemからデータベース形式への変換
export function toDbTodo(todo: TodoItem): Record<string, any> {
  return camelToSnake<Record<string, any>>(todo);
}
```

これらの関数は、データベースとアプリケーション間でデータを変換する際に使用されます。

## 4.8 リポジトリパターンの実装

LIFF-Templateプロジェクトでは、リポジトリパターンを使用してデータアクセスロジックをカプセル化しています。`todoRepository.ts`ファイルには、Todosテーブルへのアクセスを提供するリポジトリが定義されています：

```typescript
import { SupabaseService } from '@/server/services/supabaseService';
import { TodoItem } from '@/types/todo';
import { toDbTodo, toTodoItem } from '@/lib/supabase';

export class TodoRepository {
  private supabaseService: SupabaseService;

  constructor() {
    this.supabaseService = new SupabaseService();
  }

  // すべてのTodoを取得
  async findAll(userId?: string): Promise<TodoItem[]> {
    const supabase = this.supabaseService.getClient();
    let query = supabase.from('todos').select('*');
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching todos:', error);
      throw error;
    }
    
    return data.map(toTodoItem);
  }

  // 新しいTodoを作成
  async create(todo: Omit<TodoItem, 'id'>): Promise<TodoItem> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('todos')
      .insert(toDbTodo(todo as TodoItem))
      .select()
      .single();
    
    if (error) {
      console.error('Error creating todo:', error);
      throw error;
    }
    
    return toTodoItem(data);
  }

  // Todoの完了状態を切り替え
  async toggleComplete(id: number, completed: boolean): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('todos')
      .update({ completed })
      .eq('id', id);
    
    if (error) {
      console.error('Error toggling todo completion:', error);
      throw error;
    }
  }

  // Todoを削除
  async delete(id: number): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting todo:', error);
      throw error;
    }
  }

  // ユーザーのすべてのTodoを削除
  async deleteAll(userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error deleting all todos:', error);
      throw error;
    }
  }
}
```

このリポジトリは、以下の機能を提供します：
- すべてのTodoの取得（オプションでユーザーIDによるフィルタリング）
- 新しいTodoの作成
- Todoの完了状態の切り替え
- Todoの削除
- ユーザーのすべてのTodoの削除

## 4.9 LINE認証とSupabaseの統合

LIFF-Templateプロジェクトでは、LINE認証とSupabaseを統合しています。ユーザーがLINEでログインすると、LINEユーザーIDがTodoアイテムの`user_id`フィールドに保存されます。

### 4.9.1 ユーザーIDの保存

`login.actions.ts`ファイルでは、LINEユーザーIDをクッキーに保存します：

```typescript
export const setUserId = async (userId: string): Promise<void> => {
  cookies().set('userId', userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
};
```

### 4.9.2 ユーザーIDの取得と使用

サーバーアクションでは、クッキーからユーザーIDを取得し、Todoリポジトリに渡します：

```typescript
import { cookies } from 'next/headers';
import { TodoRepository } from '@/repositories/todoRepository';

export async function getTodos() {
  const userId = cookies().get('userId')?.value;
  if (!userId) {
    return [];
  }
  
  const todoRepository = new TodoRepository();
  return todoRepository.findAll(userId);
}

export async function addTodo(text: string) {
  const userId = cookies().get('userId')?.value;
  if (!userId) {
    throw new Error('User not authenticated');
  }
  
  const todoRepository = new TodoRepository();
  return todoRepository.create({
    text,
    completed: false,
    userId,
    createdAt: Date.now(),
  });
}
```

## 4.10 Supabaseのローカル開発環境

Supabaseのローカル開発環境を設定するには、Supabase CLIを使用します：

### 4.10.1 Supabase CLIのインストール

```bash
npm install -g supabase
```

### 4.10.2 ローカル開発環境の起動

```bash
supabase start
```

これにより、Dockerコンテナを使用してローカルにSupabaseスタックが起動します。

### 4.10.3 環境変数の更新

ローカル開発環境のURLとキーを使用するように、`.env.local`ファイルを更新します：

```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_local_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_local_service_role_key
```

## 4.11 本番環境への移行

開発が完了したら、本番環境に移行する際に以下の点に注意してください：

### 4.11.1 RLSポリシーの見直し

開発環境用の匿名アクセス許可ポリシーを削除または無効化します：

```sql
DROP POLICY IF EXISTS "匿名アクセス許可" ON todos;
```

### 4.11.2 本番環境の環境変数の設定

Vercelなどのデプロイメントプラットフォームで、本番環境の環境変数を設定します：

```
NEXT_PUBLIC_SUPABASE_URL=your_production_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
```

### 4.11.3 データベースのバックアップ

定期的にデータベースのバックアップを作成することをお勧めします。Supabaseダッシュボードの「Database」→「Backups」から、バックアップを作成できます。

## 4.12 まとめ

Supabaseは、LIFF-Templateプロジェクトのバックエンドとして重要な役割を果たしています。PostgreSQLデータベース、Row Level Security、認証機能を提供し、LINE認証と統合することで、安全で効率的なデータ管理を実現しています。

マイグレーションファイルを使用してデータベーススキーマを定義し、リポジトリパターンを使用してデータアクセスロジックをカプセル化することで、保守性と拡張性の高いアプリケーションを構築できます。

開発環境から本番環境への移行時には、RLSポリシーの見直しや環境変数の設定など、セキュリティに関する考慮事項に注意することが重要です。
