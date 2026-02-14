# Step7 バージョン管理トグル設計書

## 1. 目的

`step7: 7. 本文作成` で、ユーザーが「バージョン管理あり/なし」を切り替えられるようにする。  
OFF 時は通常チャットと Canvas 選択編集のどちらでも本文の見出し修正を行えるが、バージョン保存はしない。最終確定時に ON に戻して送信すると既存フローでバージョン保存する。

## 2. 仕様方針（確定）

- Step7 ON（既定）:
  - 現行どおり本文をバージョン管理
  - `blog_creation_step7` としてバージョン蓄積
- Step7 OFF:
  - 通常チャット利用可
  - Canvas 利用可（選択範囲編集）
  - `blog_creation_step7_chat` で見出し単位の部分応答を保存（バージョン対象外）
- バージョン保存:
  - 専用の保存フローは設けない
  - ユーザーが ON に戻して送信 -> `blog_creation_step7` として保存

## 3. UI 仕様

対象: `app/chat/components/StepActionBar.tsx`

| 要素 | 表示条件 | 仕様 |
|------|----------|------|
| トグル（Switch） `バージョンで保存` | Step7 常時 | 既定 ON。shadcn/ui `Switch` を使用 |
| 補助文言 | Step7 | `OFFにすると本文修正はバージョン保存されません。ONに戻して送信すると本文がバージョンとして保存されます。` |

補足:
- OFF 時も CanvasPanel は表示可能
- OFF 時の Canvas 選択編集は `blog_creation_step7_chat` へ送信し、バージョンは増やさない

## 4. 状態管理

対象: `app/chat/components/ChatLayout.tsx`

```typescript
const [step5VersioningEnabled, setStep5VersioningEnabled] = useState(true);
const [step5JustReEnabled, setStep5JustReEnabled] = useState(false);
const [step5GuardMessageCount, setStep5GuardMessageCount] = useState<number | null>(null);
```

補足:
- 変数名は後方互換のため `step5*` のまま運用しているが、実際の対象ステップは `VERSIONING_TOGGLE_STEP = 'step7'`

リセット条件:

| トリガー | `step5VersioningEnabled` | `step5JustReEnabled` |
|----------|--------------------------|----------------------|
| Step7 以外へ切り替え | `true` として扱う | `false` |
| セッション切り替え | `true` として扱う | `false` |
| OFF -> ON | `true` | `true` + `step5GuardMessageCount` に現時点の `messages.length` を保存 |
| ON 状態で送信成功（`isLoading=false` + `error=null` + ガード後に Step7 assistant 追加） | 変化なし | `false` + `step5GuardMessageCount` を `null` |

## 5. モデル定義

`blog_creation_step7_chat` を追加する（バージョン管理対象外）。

変更対象:
- `src/lib/constants.ts`
  - `MODEL_CONFIGS` に `blog_creation_step7_chat: { ...ANTHROPIC_BASE, maxTokens: 2000 }`
  - `VERSIONING_TOGGLE_STEP = 'step7'`
  - `BLOG_PLACEHOLDERS` に `blog_creation_step7_chat: '本文の見出し修正指示を入力してください（例: 見出し3を○○に変更）'`
- `src/lib/prompts.ts`
  - Step7 見出し修正チャット向けプロンプトを追加
- `src/server/actions/chat/modelHandlers.ts`
  - `blog_creation_step7_chat` のルーティング追加
- `src/lib/canvas-content.ts`
  - `findLatestAssistantBlogStep` で `blog_creation_step7_chat` を `step7` 扱い

## 6. 送信分岐

主変更箇所: `app/chat/components/InputArea.tsx`

- Step7 + ON:
  - `effectiveModel = blog_creation_step7`
  - 既存どおり（バージョン保存対象）
- Step7 + OFF:
  - `effectiveModel = blog_creation_step7_chat`
  - 通常チャット経路のみ（部分応答・バージョン管理対象外）

### Step7 固定ガード（OFF->ON 復帰時）

OFF->ON 復帰直後の最初の1送信を必ず `blog_creation_step7` に固定し、意図しないステップ進行を抑止する。

解除条件:
1. `step5JustReEnabled === true`
2. `step5GuardMessageCount !== null`
3. `chatSession.state.isLoading === false`
4. `chatSession.state.error === null`
5. `messages.slice(step5GuardMessageCount)` に `blog_creation_step7` assistant メッセージが存在

## 7. Canvas 編集時の OFF 挙動

主変更箇所: `app/chat/components/ChatLayout.tsx`, `src/hooks/useChatSession.ts`

- Step7 OFF かつ Canvas 選択編集時:
  - モデルは `blog_creation_step7_chat` を利用
  - 選択範囲制約はユーザープロンプトではなく `systemPrompt` に注入
  - ユーザー入力は自由記載の編集指示のみ
  - バージョン保存しない
- 制約プロンプト:
  - `以下の選択範囲のみを対象に修正してください。本文全体は出力しないでください。`
  - `【選択範囲】...`

## 8. 変更対象ファイル

変更:
- `app/chat/components/StepActionBar.tsx`
- `app/chat/components/ChatLayout.tsx`
- `app/chat/components/InputArea.tsx`
- `src/lib/constants.ts`
- `src/lib/prompts.ts`
- `src/server/actions/chat/modelHandlers.ts`
- `src/lib/canvas-content.ts`
- `src/hooks/useChatSession.ts`
- `src/types/hooks.ts`

## 9. テスト観点

1. Step7 ON で従来どおりバージョンが増える
2. Step7 OFF で通常送信すると `blog_creation_step7_chat` として記録され、バージョンは増えない
3. Step7 OFF で Canvas が表示される
4. Step7 OFF で Canvas 選択編集すると `blog_creation_step7_chat` へ送信される
5. Step7 OFF で Canvas 選択編集時、制約文が systemPrompt 側に入りユーザー送信文には含まれない
6. Step7 OFF -> ON 直後の送信が Step7 固定で処理される
7. Step7 固定ガードが送信成功後に解除される
8. 送信失敗時、Canvas 編集エラーが呼び出し元へ伝播し UI で失敗を認識できる
9. セッション切り替え後もトグル状態の扱いが破綻しない
10. Step7 以外（1-6）に回帰がない

## 10. 工数

| タスク | 工数 |
|--------|------|
| UI/状態管理（Step7 へ対象移行） | 0.75 人日 |
| モデル追加と送信分岐（constants / prompts / modelHandlers / InputArea） | 1.5 人日 |
| 固定ガード + 解除条件調整 | 0.5 人日 |
| Canvas OFF 時編集経路（systemPrompt 制約 + 非バージョン） | 1.0 人日 |
| テスト・回帰確認 | 1.0 人日 |

合計: 4.75 人日（目安）

## 11. リスクと対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| OFF->ON 復帰時に Step7 以外へ進む | 高 | `step5JustReEnabled` で最初の1送信を `blog_creation_step7` 固定 |
| `blog_creation_step7_chat` 登録漏れで送信失敗 | 高 | `constants/prompts/modelHandlers` の3点同時確認 |
| OFF 時 Canvas 編集で全文が返る | 高 | 選択範囲制約を `systemPrompt` へ固定注入 |
| Canvas OFF 経路の失敗が成功扱いになる | 高 | `useChatSession.sendCanvasScopedStep7Edit` で失敗を例外伝播 |
| チャット履歴の切り捨てで古い修正が失われる | 中 | ON 復帰時に要点を再指示する運用を案内 |
