---
name: rich-ui-aesthetics
description: GrowMate のブランド価値を高める、高級感のあるモダンな UI デザイン（Tailwind CSS v4, Glassmorphism, Micro-animations）の実装規約。
metadata:
  short-description: UI/UX デザイン実装規約
---

# UI/UX デザイン実装規約 (Rich UI & Aesthetics)

ユーザーに「プロフェッショナルでプレミアム」な印象を与えるための、GrowMate 固有のビジュアル規約です。

## 1. デザイン原則

- **Clean & Elegant**: 余白を贅沢に使い、情報の優先順位を明確にする。
- **Dynamic**: ユーザーの操作に対して、滑らかなトランジションやリアクションを返す。
- **Modern Textures**: 単なるフラットデザインではなく、光沢や半透明（Glassmorphism）を活用する。

## 2. 実装ガイドライン

### 2.1 Tailwind CSS v4 の活用

最新のカラーシステムとユーティリティを積極的に活用してください。

- **カラーパレット**: ブラウザ標準の原色を避け、洗練された HSL カラーを使用する。
  - 背景: `bg-slate-50` (Light) / `bg-slate-950` (Dark)
  - アクセント: `text-indigo-600` / `bg-indigo-600`
- **グラデーション**: 微妙なトーン変化を付ける。
  ```html
  <div class="bg-gradient-to-br from-indigo-500/10 to-purple-500/5">...</div>
  ```

### 2.2 Glassmorphism (半透明効果)

ダッシュボードやダイアログに奥行きを与えます。

```html
<div class="backdrop-blur-md bg-white/70 border border-white/20 shadow-xl rounded-2xl">
  <!-- Content -->
</div>
```

### 2.3 Micro-animations & Interactions

`tw-animate-css` や CSS Transitions を組み合わせて「生きている」UI を作ります。

- **Hover 状態**: 僅かな浮き上がりや光の反射。
  ```html
  <button
    class="transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
  >
    Action
  </button>
  ```
- **Loading**: スケルトンスクリーンを活用し、待機時間を不快にさせない。

### 2.4 Typography

- **フォント**: `Outfit` や `Inter` などのモダンなフォントを基本とする。
- **階層**: `h1` は大胆に、本文は読みやすさを最優先。

## 3. コンポーネント設計 (shadcn/ui カスタマイズ)

- **Border Radius**: デフォルトの `rounded-md` よりも少し丸みのある `rounded-xl` や `rounded-2xl` を推奨。
- **Spacing**: コンテンツ間のマージンを `space-y-6` や `p-8` 程度に広めに取る。

## 4. セルフレビュー項目

- [ ] デザインに「チープさ」がないか（原色、狭い余白、フラットすぎる要素）
- [ ] インタラクティブな要素に適切なホバー・アクティブ状態が設定されているか
- [ ] 背景や境界線に Glassmorphism の手法を取り入れているか
- [ ] レスポンシブ対応がなされ、モバイルでも美しさが維持されているか
- [ ] ローディング中やエラー時のステートがデザインされているか
