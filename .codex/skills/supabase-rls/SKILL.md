---
name: supabase-rls
description: Supabase RLS 最適化。セキュリティ境界（RLS）と最適化用フィルタの役割を明確化。
metadata:
  short-description: プロジェクト規約準拠の RLS 実装
---

# Supabase RLS パフォーマンス & ベストプラクティス

## 指針と命令

- [ ] **セキュリティ境界の厳守**: `SupabaseService` 等でのフィルタ（`.eq()`）はあくまで**パフォーマンス最適化**目的であり、セキュリティは必ず RLS で担保すること。
- [ ] **initPlan**: `auth.uid()` 等を `(SELECT auth.uid())` でラップしてキャッシュ。
- [ ] **インデックス**: `USING` 句のカラムにインデックスを付与。
- [ ] **SECURITY DEFINER の安全策**:
  - [CAUTION] `SET search_path = public` を指定。
  - 関数内部では `public.memberships` のように**スキーマ修飾**を推奨。
- [ ] **変更管理**: `supabase/migrations/` で管理し、ロールバック手順をコメント。

## 良い実装例

```sql
-- migration ファイル内
CREATE POLICY "Secure data access" ON public.data
  FOR SELECT USING (
    user_id = (SELECT auth.uid())
  );

-- ロールバック手順を常に併記
-- DROP POLICY "Secure data access" ON public.data;
```

## 参照

- [Supabase Docs: RLS Performance](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- 本プロジェクト統一方針: サーバーサイド（`SupabaseService`）での実装
