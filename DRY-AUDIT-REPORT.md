# Next.js 15 + React 19 DRY監査レポート
**プロジェクト**: industry-specific-mc-training  
**監査日**: 2025-11-07  
**総ファイル数**: 138 TypeScript/TSXファイル  
**ツール**: knip 5.68.0, ts-prune 0.10.3, madge 8.0.0, ESLint 9

---

## エグゼクティブサマリ

### 全体スコア: **B+ (良好、改善の余地あり)**

| カテゴリ | スコア | 検出数 | 重大度 |
|---------|--------|--------|--------|
| **未使用コード** | C | 67件 | Medium |
| **Supabaseクエリの重複** | B- | 23箇所の散在 | Medium-High |
| **状態管理の冗長性** | C+ | 42箇所の重複パターン | Medium |
| **循環参照** | A+ | 0件 | - |
| **ESLint品質** | A | 0エラー | - |
| **React 19対応度** | C | Server Actions 2件のみ | Low |

**推定削減可能コード量**: ~800-1200行 (全体の約5-8%)  
**推定リファクタ工数**: 2-3日（段階的実施）

---

## 1. 未使用コード検出結果

### 1.1 未使用ファイル (1件) ⚠️ HIGH

```
src/server/handler/actions/prompt.actions.ts
```

**推奨アクション**: 
- ファイル全体が未使用の場合、削除を検討
- または、使用されているかgit履歴を確認

### 1.2 未使用devDependencies (4件) ℹ️ INFO

```json
{
  "eslint": "package.json:57:6",
  "eslint-config-next": "package.json:58:6",
  "eslint-config-prettier": "package.json:59:6",
  "prettier": "package.json:62:6"
}
```

**判定**: **誤検知** - これらはnpm scriptsで使用されているため保持すべき

### 1.3 未使用Exports (66件) ⚠️ MEDIUM

#### カテゴリ別内訳

| カテゴリ | 件数 | ファイル例 |
|---------|------|-----------|
| **shadcn/ui未使用パーツ** | 18 | avatar.tsx, dialog.tsx, select.tsx, sheet.tsx |
| **プロンプト関連** | 20 | prompts.ts, prompt-descriptions.ts |
| **Server Actions** | 15 | chat.actions.ts, wordpress.action.ts |
| **型定義** | 8 | types/chat.ts, types/user.ts |
| **その他** | 5 | env.ts, blog-canvas.ts |

#### 高優先度の削除候補（Rule of Three適用後）

```typescript
// src/components/ui/* - 未使用のshadcn/uiパーツ（18件）
- AvatarImage, AvatarFallback
- DialogPortal, DialogOverlay, DialogClose
- SelectGroup, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator
- SheetClose, SheetHeader, SheetFooter, SheetTitle, SheetDescription
- CardFooter, CardAction
- badgeVariants

// src/lib/prompts.ts - 未使用プロンプト生成関数（9件）
- SYSTEM_PROMPT
- KEYWORD_CATEGORIZATION_PROMPT
- AD_COPY_PROMPT, AD_COPY_FINISHING_PROMPT
- AD_COPY_PROMPT_TEMPLATE, AD_COPY_FINISHING_PROMPT_TEMPLATE
- LP_DRAFT_PROMPT_TEMPLATE, LP_DRAFT_PROMPT
- generateAdCopyPrompt, generateAdCopyFinishingPrompt, generateLpDraftPrompt

// src/server/handler/actions/chat.actions.ts - 未使用Server Actions（11件）
- startChat, continueChat, getChatSessions, getSessionMessages
- searchChatSessions, deleteChatSession, updateChatSessionTitle
- saveMessage, unsaveMessage, getSavedMessageIds, getAllSavedMessages

// src/types/* - 未使用型変換関数（2件）
- toDbChatMessage, toDbChatSession
```

---

## 2. Supabaseクエリの重複 ⚠️ HIGH PRIORITY

### 2.1 現状分析

**総クエリ数**: 79箇所（実Supabaseクエリは約50箇所、残りはArray.from）

| ファイル | クエリ数 | 主なテーブル |
|---------|---------|-------------|
| `supabaseService.ts` | 29 | users, chat_sessions, chat_messages, wordpress_settings, briefs, search_results |
| `wordpress.action.ts` | 16 | **content_annotations (重複)** |
| `promptService.ts` | 11 | **content_annotations (重複)**, prompt_templates, prompt_versions |
| その他 | ~10 | content_annotations, wordpress_settings |

### 2.2 重複パターン: `content_annotations` テーブル (23箇所)

**問題**: 同じテーブルへのクエリが複数ファイルに散在

#### 散在箇所
```
src/server/handler/actions/wordpress.action.ts      : 16箇所
src/server/services/promptService.ts                : 4箇所
app/api/admin/wordpress/bulk-import-posts/route.ts  : 3箇所
app/api/chat/canvas/load-wordpress/route.ts         : 1箇所
```

#### 代表的な重複パターン

**パターンA: ユーザーごとの全注釈取得**
```typescript
// wordpress.action.ts:681
const { data, error } = await client
  .from('content_annotations')
  .select('*')
  .eq('user_id', authResult.userId);

// promptService.ts:31
const { data, error } = await client
  .from('content_annotations')
  .select('canonical_url, wp_post_title')
  .eq('user_id', userId)
  .not('canonical_url', 'is', null)
  .order('updated_at', { ascending: false });
```

**パターンB: セッションIDでの単一注釈取得**
```typescript
// wordpress.action.ts:823
const { data, error } = await client
  .from('content_annotations')
  .select('*')
  .eq('user_id', authResult.userId)
  .eq('session_id', session_id)
  .maybeSingle();

// promptService.ts:106
const { data, error } = await client
  .from('content_annotations')
  .select('canonical_url, wp_post_title, main_kw, ...')
  .eq('user_id', userId)
  .eq('session_id', sessionId)
```

### 2.3 推奨リファクタ案 💡

**ステップ1**: 専用リポジトリクラスの作成

```typescript
// src/server/repositories/ContentAnnotationRepository.ts
import { SupabaseService } from '../services/supabaseService';
import type { AnnotationRecord } from '@/types/annotation';

export class ContentAnnotationRepository {
  private supabase = new SupabaseService();

  /**
   * ユーザーの全注釈を取得（最新順）
   */
  async findByUserId(userId: string): Promise<AnnotationRecord[]> {
    return this.supabase.withServiceRoleClient(async (client) => {
      const { data, error } = await client
        .from('content_annotations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      
      if (error) throw new Error(error.message);
      return data ?? [];
    });
  }

  /**
   * セッションIDで注釈を取得
   */
  async findBySessionId(
    userId: string, 
    sessionId: string
  ): Promise<AnnotationRecord | null> {
    return this.supabase.withServiceRoleClient(async (client) => {
      const { data, error } = await client
        .from('content_annotations')
        .select('*')
        .eq('user_id', userId)
        .eq('session_id', sessionId)
        .maybeSingle();
      
      if (error) throw new Error(error.message);
      return data;
    });
  }

  /**
   * canonical URLのリスト取得（プロンプト用）
   */
  async findCanonicalUrls(userId: string): Promise<Array<{ 
    canonical_url: string; 
    wp_post_title: string 
  }>> {
    return this.supabase.withServiceRoleClient(async (client) => {
      const { data, error } = await client
        .from('content_annotations')
        .select('canonical_url, wp_post_title')
        .eq('user_id', userId)
        .not('canonical_url', 'is', null)
        .order('updated_at', { ascending: false });
      
      if (error) throw new Error(error.message);
      return data ?? [];
    });
  }

  /**
   * 注釈のupsert
   */
  async upsert(annotation: Partial<AnnotationRecord>): Promise<void> {
    return this.supabase.withServiceRoleClient(async (client) => {
      const { error } = await client
        .from('content_annotations')
        .upsert(annotation, { onConflict: 'user_id,wp_post_id' });
      
      if (error) throw new Error(error.message);
    });
  }
}
```

**ステップ2**: 既存コードの置き換え

```typescript
// Before (wordpress.action.ts)
const client = new SupabaseService().getClient();
const { data, error } = await client
  .from('content_annotations')
  .select('*')
  .eq('user_id', authResult.userId);
if (error) return { success: false, error: error.message };

// After
const repo = new ContentAnnotationRepository();
try {
  const data = await repo.findByUserId(authResult.userId);
  // ...
} catch (err) {
  return { success: false, error: err.message };
}
```

**効果**:
- 重複削除: 23箇所 → 4-5メソッド（約80%削減）
- 保守性向上: クエリロジックの一元管理
- テスト容易性: リポジトリをモック可能

---

## 3. 状態管理の冗長性 ⚠️ MEDIUM

### 3.1 useStateパターン分析（42箇所）

#### エラー状態の重複パターン（10箇所以上）

```typescript
// パターン: エラー状態の重複定義
const [error, setError] = useState<string | null>(null);

// 出現箇所（部分）:
- src/hooks/useSubscription.ts:12
- src/hooks/useLiff.ts:17
- app/subscription/success/page.tsx:20
- app/subscription/page.tsx:25
- app/chat/components/ChatLayout.tsx:522
- app/admin/prompts/page.tsx:38
- app/admin/users/page.tsx:57
- app/admin/wordpress-import/page.tsx:42
- app/page.tsx:109
```

### 3.2 推奨リファクタ案 💡

**カスタムHookへの集約**

```typescript
// src/hooks/useAsyncOperation.ts
import { useState, useCallback } from 'react';

export interface UseAsyncOperationResult<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  execute: (...args: any[]) => Promise<void>;
  reset: () => void;
}

export function useAsyncOperation<T = any>(): UseAsyncOperationResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const execute = useCallback(async (asyncFn: () => Promise<T>) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await asyncFn();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { data, error, isLoading, execute, reset };
}
```

**使用例（Before/After）**

```typescript
// Before (app/admin/users/page.tsx)
const [users, setUsers] = useState<User[]>([]);
const [error, setError] = useState<string | null>(null);
const [editingUserId, setEditingUserId] = useState<string | null>(null);
const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

// After
const { 
  data: users, 
  error, 
  isLoading, 
  execute: fetchUsers 
} = useAsyncOperation<User[]>();

const [editingUserId, setEditingUserId] = useState<string | null>(null);
const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
```

**効果**:
- コード削減: 約3-5行 × 10箇所 = 30-50行
- 一貫性向上: エラーハンドリングの標準化
- 保守性向上: ロジックの一元管理

---

## 4. React 19 / Next.js 15 最適化候補 ⚠️ MEDIUM

### 4.1 現状

- **Client Components**: 8ファイル（少ない、良好）
- **Server Actions**: 2ファイル（少ない）
- **フォーム送信ハンドラ**: 7箇所（Form Actions移行候補）

### 4.2 Form Actions移行候補

現在のフォーム送信パターン（Client Side）:

```typescript
// app/business-info/components/BusinessInfoFormClient.tsx（例）
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  
  try {
    const result = await saveBrief(form);
    if (!result.success) {
      setError(result.error);
    }
  } catch (err) {
    setError('保存に失敗しました');
  }
};

return <form onSubmit={handleSubmit}>...</form>;
```

**React 19 Form Actions移行案**:

```typescript
// src/server/handler/actions/brief.actions.ts (Server Action)
'use server'

export async function saveBriefAction(formData: FormData) {
  const userId = await getCurrentUserId();
  
  const briefData = {
    what: formData.get('what'),
    who: formData.get('who'),
    // ...
  };

  const result = await saveBrief(briefData);
  return result;
}

// app/business-info/components/BusinessInfoForm.tsx (Server Component)
import { saveBriefAction } from '@/server/handler/actions/brief.actions';

export function BusinessInfoForm({ initialData }) {
  return (
    <form action={saveBriefAction}>
      <input name="what" defaultValue={initialData.what} />
      {/* ... */}
      <button type="submit">保存</button>
    </form>
  );
}
```

**効果**:
- クライアントバンドル削減: 推定 5-10KB
- セキュリティ向上: サーバー側で認証・検証
- UX向上: Progressive Enhancement対応

### 4.3 useOptimistic移行候補

現在の楽観的UI実装（手動）:

```typescript
// app/chat/components/ChatLayout.tsx:516
const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);

// メッセージ送信時
setOptimisticMessages([...messages, newMessage]);
await sendMessage(newMessage);
setOptimisticMessages([]);
```

**React 19 useOptimistic移行案**:

```typescript
import { useOptimistic } from 'react';

function ChatLayout({ initialMessages }) {
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    initialMessages,
    (state, newMessage: ChatMessage) => [...state, newMessage]
  );

  async function sendMessage(formData: FormData) {
    const message = createMessageFromFormData(formData);
    addOptimisticMessage(message);
    await sendMessageAction(formData);
  }

  return (
    <form action={sendMessage}>
      {optimisticMessages.map(msg => <MessageItem key={msg.id} {...msg} />)}
      <input name="content" />
    </form>
  );
}
```

**効果**:
- コード簡潔化: 約10-15行削減
- React並行機能の活用
- エラー時の自動ロールバック

---

## 5. セーフリファクタ実施計画

### Phase 1: 未使用コード削除（1日、低リスク）

**優先度: HIGH、リスク: LOW**

#### タスク1.1: 未使用shadcn/uiパーツ削除
```bash
# 削除対象（18件）
- src/components/ui/avatar.tsx の AvatarImage, AvatarFallback
- src/components/ui/dialog.tsx の DialogPortal, DialogOverlay, DialogClose
- src/components/ui/select.tsx の SelectGroup, SelectLabel, など
- src/components/ui/sheet.tsx の SheetClose, SheetHeader, など
```

**検証方法**:
```bash
npm run lint
npm run build
# ビルド成功を確認
```

#### タスク1.2: 未使用プロンプト関数削除
```typescript
// src/lib/prompts.ts から以下を削除:
- SYSTEM_PROMPT
- KEYWORD_CATEGORIZATION_PROMPT
- AD_COPY_PROMPT, AD_COPY_FINISHING_PROMPT
- 関連するTEMPLATE定数
- generate系未使用関数
```

**ロールバック**: `git revert <commit-hash>`

---

### Phase 2: Supabaseクエリの統合（1-2日、中リスク）

**優先度: HIGH、リスク: MEDIUM**

#### タスク2.1: ContentAnnotationRepositoryの作成
```bash
# 新規ファイル作成
touch src/server/repositories/ContentAnnotationRepository.ts
```

#### タスク2.2: 段階的な移行（ファイル単位）
```
1. wordpress.action.ts の16箇所を移行
2. promptService.ts の4箇所を移行
3. Route Handlers を移行
```

**テスト方法**:
```bash
# 各ステップ後に実行
npm run dev
# 手動で以下を確認:
# - /analytics でWordPress投稿一覧表示
# - 注釈の保存・読み込み
# - ブログ生成時のプロンプト変数注入
```

**ロールバック**: コミット単位でrevert可能

---

### Phase 3: 状態管理の最適化（0.5日、低リスク）

**優先度: MEDIUM、リスク: LOW**

#### タスク3.1: useAsyncOperationフックの作成と適用
```bash
# 新規ファイル作成
touch src/hooks/useAsyncOperation.ts

# 適用箇所（優先度順）:
1. app/admin/users/page.tsx
2. app/admin/prompts/page.tsx
3. app/subscription/page.tsx
```

**テスト方法**: 各画面で非同期操作（データ取得・保存）を実行

---

### Phase 4: React 19移行（1-2日、高リスク）

**優先度: LOW、リスク: HIGH**

#### タスク4.1: Form Actionsへの移行（段階的）
```
1. business-info フォーム
2. admin プロンプト編集フォーム
3. WordPressSettings フォーム
```

#### タスク4.2: useOptimisticの導入
```
1. ChatLayout の楽観的メッセージ送信
```

**テスト方法**:
- E2Eテスト（手動またはPlaywright導入）
- ネットワーク切断時の挙動確認

**ロールバック**: feature ブランチで実施、問題時はPRクローズ

---

## 6. 測定指標（Before / After）

| 指標 | Before | After（推定） | 改善率 |
|------|--------|--------------|--------|
| **総行数** | ~15,000行 | ~14,000行 | -6.7% |
| **未使用exports** | 66件 | 5件以下 | -92% |
| **content_annotationsクエリ** | 23箇所 | 5メソッド | -78% |
| **useState重複** | 42箇所 | 32箇所 | -24% |
| **Server Actions** | 2ファイル | 5ファイル | +150% |
| **クライアントバンドル** | ~250KB (推定) | ~230KB (推定) | -8% |

---

## 7. リスク評価とガードレール

### 高リスク操作

1. **未使用ファイル削除**: `prompt.actions.ts`
   - ⚠️ 使用箇所をGit履歴で再確認すべき
   
2. **Server Actions未使用exports**:
   - `startChat`, `continueChat` 等は本当に未使用か確認
   - Route Handlersから直接呼び出されている可能性

### ガードレール

- **Rule of Three適用**: 2回以下の出現は抽象化しない
- **段階的コミット**: 各Phaseを個別コミット、PRレビュー必須
- **回帰テスト**: 各Phase後に主要フロー（LIFF認証→Chat→Canvas）を手動確認

---

## 8. 次のアクション（推奨順）

### 即座に実施可能（低リスク）

1. ✅ **未使用shadcn/uiパーツ削除**（30分）
   ```bash
   # 18個のexportを削除
   ```

2. ✅ **未使用プロンプト関数削除**（1時間）
   ```bash
   # src/lib/prompts.ts から9個の関数削除
   ```

### 計画的実施（中リスク）

3. 📋 **ContentAnnotationRepository作成**（3-4時間）
   - リポジトリクラス実装
   - wordpress.action.ts の16箇所を移行
   - promptService.ts の4箇所を移行

4. 📋 **useAsyncOperationフック導入**（2-3時間）
   - フック実装
   - 3-5ファイルに適用

### 慎重に検討（高リスク）

5. 🔍 **React 19 Form Actions移行**（1-2日）
   - feature ブランチで実施
   - E2Eテスト整備後に実施推奨

---

## 9. 補足: ツール実行ログ

### knip実行結果（要約）
```
✓ Unused files: 1
✓ Unused exports: 66
✓ Unused devDependencies: 4 (誤検知)
```

### madge実行結果
```
✔ No circular dependency found!
```

### ESLint実行結果
```
✔ 0 errors, 0 warnings
```

---

## 付録: パッチ案サンプル

### A) ContentAnnotationRepository導入パッチ

**新規ファイル**: `src/server/repositories/ContentAnnotationRepository.ts`
```typescript
// 上記セクション2.3参照（約100行）
```

**変更ファイル**: `src/server/handler/actions/wordpress.action.ts`
```diff
+ import { ContentAnnotationRepository } from '@/server/repositories/ContentAnnotationRepository';

  export async function getContentAnnotationsForUser() {
    const authResult = await authMiddleware.ensureAuthenticated();
    if (authResult.error || !authResult.userId)
      return { success: false as const, error: 'ユーザー認証に失敗しました' };

-   const client = new SupabaseService().getClient();
-   const { data, error } = await client
-     .from('content_annotations')
-     .select('*')
-     .eq('user_id', authResult.userId);
-
-   if (error) return { success: false as const, error: error.message };
-   const typedData = (data ?? []) as AnnotationRecord[];
+   const repo = new ContentAnnotationRepository();
+   try {
+     const typedData = await repo.findByUserId(authResult.userId);
      return { success: true as const, data: typedData };
+   } catch (err) {
+     return { success: false as const, error: err.message };
+   }
  }
```

---

**レポート終了**  
**総ページ数**: 推定A4 8-10ページ相当  
**生成時刻**: 2025-11-07

