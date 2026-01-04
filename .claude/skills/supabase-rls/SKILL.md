---
name: supabase-rls
description: Supabase RLS パフォーマンス最適化。セキュリティ境界と最適化フィルタの区別、および堅牢な関数定義を規定。
---

# Supabase RLS パフォーマンス & ベストプラクティス

このスキルは、Supabase の Row Level Security (RLS) を安全かつ高効率に実装するためのガイドラインを提供します。

## 命令 (Instructions)

1.  **インデックスの確認**:
    - `USING` 句で使用されるカラム（`user_id`, `org_id` 等）には必ず B-tree インデックスを作成してください。

2.  **auth.uid() のキャッシュ**:
    - `auth.uid()` を `(SELECT auth.uid())` でラップし、Postgres の `initPlan` キャッシュを有効にすることを推奨してください。

3.  **SECURITY DEFINER の堅牢化**:
    - [WARNING] 権限昇格を防ぐため、以下の措置を必須としてください。
      - `SET search_path = public` を指定する。
      - 関数内でのテーブル・関数参照は `public.users` のように**スキーマ名で修飾**する。
      - 入力パラメータの検証を関数冒頭で行う。

4.  **コード上でのフィルタリング (サーバーサイド限定)**:
    - 本プロジェクトのサーバーサイド実装（`SupabaseService` や Server Actions）において、クエリに `.eq('user_id', userId)` 等を明示的に追加することを推奨してください。
    - **重要**: コード上のフィルタは「パフォーマンス最適化とクエリの意図明示」のためであり、**セキュリティ境界は常に RLS 側で担保**されなければならないことを明記してください。

5.  **マイグレーション手順**:
    - 変更は `supabase/migrations/` 配下に SQL ファイルとして隔離し、ロールバック（`DROP POLICY` 等）をコメントで残してください。

## 例 (Examples)

### 堅牢な SECURITY DEFINER 関数

```sql
CREATE OR REPLACE FUNCTION public.is_admin(user_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- スキーマ修飾 (public.) による安全な参照
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE public.user_roles.user_id = $1
    AND public.user_roles.role = 'admin'
  );
END;
$$;
```
