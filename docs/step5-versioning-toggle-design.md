# Step5 バージョン管理トグル設計書

## 1. 目的

`step5: 5. 構成案確認` で、ユーザーが「バージョン管理あり/なし」を切り替えられるようにする。  
OFF 時は通常チャットで見出し単位の修正を行い（部分応答・低トークン）、最終確定時に ON に戻して既存フローでバージョン保存する。

## 2. 仕様方針（確定）

- Step5 ON（既定）:
  - 現行どおり Canvas を利用
  - `blog_creation_step5` としてバージョン蓄積
- Step5 OFF:
  - **Canvas は使わない（非表示）**
  - 通常チャットのみ利用
  - `blog_creation_step5_chat` で見出し単位の部分応答を保存（バージョン対象外）
- バージョン保存:
  - **専用の保存フローは設けない**
  - ユーザーが ON に戻してチャット送信 → 既存の Canvas 全文生成フロー → `blog_creation_step5` として自動保存
  - OFF 中のチャット履歴が残っているため、AI は修正内容を把握した上で全文を生成する

## 3. UI 仕様

対象: `app/chat/components/StepActionBar.tsx`

| 要素 | 表示条件 | 仕様 |
|------|----------|------|
| トグル（Switch） `バージョンとして保存する` | Step5 常時 | 既定 ON。shadcn/ui `Switch` を使用 |
| 補助文言 | Step5 + OFF | `Canvasを使わず通常チャットで修正します。ONに戻して送信するとバージョンとして保存されます。` |

補足:
- OFF 時は右側 CanvasPanel を表示しない。Canvas 表示条件を `canvasPanelOpen && !(resolvedBlogStep === 'step5' && !step5VersioningEnabled)` とし、他経路で `canvasPanelOpen` が `true` になっても OFF 中は開かないようにする（`ChatLayout.tsx` の CanvasPanel 表示分岐）
- OFF 時は Canvas 編集 API を呼ばない

## 4. 状態管理

対象: `app/chat/components/ChatLayout.tsx`

```typescript
const [step5VersioningEnabled, setStep5VersioningEnabled] = useState(true);
const [step5JustReEnabled, setStep5JustReEnabled] = useState(false);
const [step5GuardMessageCount, setStep5GuardMessageCount] = useState<number | null>(null);
```

リセット条件:

| トリガー | `step5VersioningEnabled` | `step5JustReEnabled` |
|----------|--------------------------|----------------------|
| Step5 以外へ切り替え | `true` にリセット | `false` |
| セッション切り替え | `true` にリセット | `false` |
| OFF → ON | `true` | **`true`** + `step5GuardMessageCount` に現時点の `messages.length` を保存 |
| ON 状態で送信成功（`isLoading=false` + `error=null` + ガード後に Step5 assistant 追加） | 変化なし | `false` + `step5GuardMessageCount` を `null`（`useEffect` 監視で解除） |

## 5. モデル定義

`blog_creation_step5_chat` を追加する（バージョン管理対象外）。

変更対象:
- `src/lib/constants.ts`
  - `MODEL_CONFIGS` に `blog_creation_step5_chat: { ...ANTHROPIC_BASE, maxTokens: 2000 }`（部分応答のため `blog_creation_step5` の 5000 より低く設定）
  - `BLOG_PLACEHOLDERS` に `blog_creation_step5_chat: '構成案の修正指示を入力してください（例: 見出し3を○○に変更）'`
- `src/lib/prompts.ts`
  - Step5 見出し修正チャット向けプロンプトを追加
- `src/server/actions/chat/modelHandlers.ts`
  - `blog_creation_step5_chat` のルーティング追加

前提:
- `blog_creation_step5_chat` は `BlogStepId` に追加しない
- `extractBlogStepFromModel` の現行挙動でバージョン配列から自動除外される
- `blog_creation_step5_chat` 用プロンプトで、応答形式を **「ユーザーが指示した見出しの修正結果のみ」** に固定する
  - 全文は返さない（トークン節約のため）
  - ON に戻して送信した時に、AI がチャット履歴から修正内容を把握して全文を生成する

## 6. 送信分岐

主変更箇所: `app/chat/components/InputArea.tsx`

- Step5 + ON:
  - `effectiveModel = blog_creation_step5`
  - 既存どおり（Canvas 全文生成 → バージョン保存）
- Step5 + OFF:
  - `effectiveModel = blog_creation_step5_chat`
  - 通常チャット経路のみ（見出し単位の部分応答）

### Step5 固定ガード（OFF→ON 復帰時）

既存の `InputArea.tsx` `handleSubmit`（289-297行目）は、`shouldAdvance`（`waitingAction` or `idle && hasDetectedBlogStep`）が `true` の場合に次ステップへ進める。OFF→ON 復帰直後にこの条件が成立すると、ユーザーの意図に反して Step6 に進んでしまう。

**対策**: `step5JustReEnabled` フラグにより、OFF→ON 復帰直後の最初の1送信を **必ず `blog_creation_step5` に固定** する。既存の `shouldAdvance` ロジックを完全にスキップするため、Step6 への意図しない進行は発生しない。

`InputArea.tsx` の `handleSubmit` に以下の条件を追加する:

```typescript
// Step5 OFF→ON 復帰直後は Step5 に固定（ステップ進行を抑止）
if (step5JustReEnabled && currentStep === 'step5') {
  effectiveModel = 'blog_creation_step5';
  onModelChange?.('blog_creation', 'step5');
} else {
  // 既存のステップ進行ロジック（shouldAdvance 判定含む）
}
```

**ガード解除契機**: `ChatLayout.tsx` の `useEffect` で以下の条件をすべて満たした時に `setStep5JustReEnabled(false)` を実行する。

```typescript
// OFF→ON 切り替え時にガード開始 + メッセージ数スナップショット保存
const handleStep5ReEnable = () => {
  setStep5VersioningEnabled(true);
  setStep5JustReEnabled(true);
  setStep5GuardMessageCount(chatSession.state.messages.length);
};

// ガード解除の useEffect
useEffect(() => {
  if (
    step5JustReEnabled &&
    step5GuardMessageCount !== null &&
    !chatSession.state.isLoading &&
    chatSession.state.error === null &&
    chatSession.state.messages
      .slice(step5GuardMessageCount) // ガード開始後に追加されたメッセージのみ
      .some(m => m.role === 'assistant' && m.model === 'blog_creation_step5')
  ) {
    setStep5JustReEnabled(false);
    setStep5GuardMessageCount(null);
  }
}, [step5JustReEnabled, step5GuardMessageCount, chatSession.state.isLoading, chatSession.state.error, chatSession.state.messages]);
```

解除条件:
1. `step5JustReEnabled === true`（ガード中）
2. `step5GuardMessageCount !== null`（スナップショットあり）
3. `chatSession.state.isLoading === false`（ストリーミング完了）
4. `chatSession.state.error === null`（送信成功）
5. `messages.slice(step5GuardMessageCount)` に `blog_creation_step5` の assistant メッセージが存在する（**ガード開始後に新規追加されたもののみ**）

エラー時（`chatSession.state.error !== null`）はガードを維持し、ユーザーの次回送信で再試行される。`sendMessage` は内部で例外を握り `state.error` に格納する実装のため（`useChatSession.ts:274-289`）、例外ベースの制御は使わない。

## 7. バージョン保存フロー（既存フロー流用）

専用の保存 Server Action は設けない。以下の既存フローをそのまま利用する。

```
1. ユーザーが OFF で見出し修正をやり取り（部分応答）
2. 満足したら ON に戻す
3. ユーザーがチャット欄から送信（例: 「これまでの修正を反映した構成案を出力して」）
4. InputArea → effectiveModel = blog_creation_step5
5. 既存の Canvas 全文生成フロー → chatService.continueChat で保存
6. blogCanvasVersionsByStep['step5'] にバージョン追加
```

チャット履歴に OFF 中のやり取り（`blog_creation_step5_chat`）が含まれるため、AI は修正内容を把握した上で全文を生成する。

## 8. 変更対象ファイル

変更:
- `app/chat/components/StepActionBar.tsx` — Switch UI + 補助文言
- `app/chat/components/ChatLayout.tsx` — `step5VersioningEnabled` / `step5JustReEnabled` state + リセット + Canvas 非表示条件
- `app/chat/components/InputArea.tsx` — 送信モデル分岐 + Step5 固定ガード（`step5JustReEnabled` 時の `shouldAdvance` スキップ）
- `src/lib/constants.ts` — `MODEL_CONFIGS` / `BLOG_PLACEHOLDERS` 追加
- `src/lib/prompts.ts` — Step5 チャット用プロンプト追加
- `src/server/actions/chat/modelHandlers.ts` — ルーティング追加

変更不要:
- `src/server/actions/chat.actions.ts` — 専用保存 Action 不要
- `src/lib/canvas-content.ts` — `extractBlogStepFromModel` は既に `step5_chat` を除外
- `app/chat/components/CanvasPanel.tsx` — OFF 時非表示は ChatLayout 側で制御
- `src/hooks/useChatSession.ts`
- `src/domain/services/chatService.ts`

## 9. テスト観点

1. Step5 ON で従来どおりバージョンが増える
2. Step5 OFF で送信すると `blog_creation_step5_chat` として記録され、バージョンは増えない
3. Step5 OFF で Canvas が表示されない
4. Step5 OFF 中に Canvas 表示ボタンを押しても CanvasPanel が開かない
5. Step5 OFF → ON に戻し、ユーザーがチャット欄から修正した完成版の構成案を送信すると、`blog_creation_step5` として保存される
6. **Step5 OFF → ON 復帰直後の送信が Step6 に進まず Step5 として処理される（固定ガード）**
7. **Step5 固定ガードは最初の送信後に解除され、次回以降は通常のステップ進行に戻る**
8. Step5 → Step6 切り替えで `step5VersioningEnabled` が `true` にリセットされる
9. セッション切り替えで `step5VersioningEnabled` が `true` にリセットされる
10. Step5 以外（1-4/6-7）に回帰がない
11. **OFF 中に `CHAT_HISTORY_LIMIT`（10件）を超えるやり取りを行った後、ON 復帰→送信で古い修正指示が欠落した場合でも、ユーザーが送信メッセージ内で修正内容を明示すれば正しく全文生成される**

## 10. 工数

| タスク | 工数 |
|--------|------|
| UI/状態管理（Switch 導入、OFF 時 Canvas 非表示、補助文言） | 0.75 人日 |
| モデル追加と送信分岐（constants / prompts / modelHandlers / InputArea） | 1.5 人日 |
| Step5 固定ガード（`step5JustReEnabled` / `step5GuardMessageCount` + useEffect + handleSubmit 分岐） | 0.5 人日 |
| テスト・回帰確認（ガード系3項目含む） | 1.0 人日 |
| バッファ（プロンプト調整） | 0.5 人日 |

**合計: 4.25 人日（目安 3.75〜4.75 人日）**

## 11. リスクと対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| OFF→ON 復帰時にステップが Step6 に進んでしまう | 高 | `step5JustReEnabled` フラグで最初の1送信を `blog_creation_step5` に固定。`InputArea.tsx` の `handleSubmit` で `step5JustReEnabled && currentStep === 'step5'` 時に `shouldAdvance` を完全スキップ。ガード解除は `ChatLayout` の `useEffect` で `isLoading=false` + `error=null` + **ガード開始後**（`messages.slice(step5GuardMessageCount)`）に Step5 assistant 追加を検知して実行。過去メッセージによる誤解除なし。送信失敗時（`error !== null`）はガード維持 |
| `blog_creation_step5_chat` 登録漏れで送信失敗 | 高 | モデル追加タスク（5項）完了時に以下3点を確認: ① `constants.ts` の `MODEL_CONFIGS` にエントリ存在 ② `prompts.ts` にプロンプトテンプレート存在 ③ `modelHandlers.ts` のルーティングに分岐存在 |
| OFF→ON 後の送信で AI が修正内容を反映しない | 高 | チャット履歴に OFF 中のやり取りが含まれることを前提とする。`CHAT_HISTORY_LIMIT`（10件）/ `CHAT_HISTORY_CHAR_LIMIT`（30,000字）の範囲内で修正履歴が保持されることをテストで検証 |
| `blog_creation_step5_chat` の `maxTokens` がコスト削減目的と不整合 | 中 | 部分応答（見出し単位）に合わせ `maxTokens: 2000` に設定。`blog_creation_step5`（5000）との差分をコード内コメントで明記 |
| OFF 時挙動の誤解 | 中 | 補助文言で「ON に戻して送信するとバージョン保存される」を常時表示 |
| チャット履歴の切り捨てにより古い修正が失われる | 中 | `CHAT_HISTORY_LIMIT`（10件）を超えた場合、古い修正指示が AI に渡らない。ON 復帰時にユーザーが「以下の修正を反映して: ①… ②…」と明示指示することで回避可能。テスト項目に 10件超シナリオを追加（テスト観点11） |
