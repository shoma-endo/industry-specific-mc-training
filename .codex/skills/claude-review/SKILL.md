---
name: claude-review
description: |
  Claudeを「レビュー役」として、Codex（または外部実装者）の変更を厳格にレビュー。
  結果をJSON（ok: true/false）で出力し、合格するまでCodexに差し戻す。
  トリガー: "Claudeレビュー", "レビューゲート実行", "厳格レビュー", "差し戻し"
---

# Claude反復レビュー (逆引きレビュー版)

Claude（レビュー役）がCodex（実装担当）の変更を検証し、GrowMateプロジェクトの品質・セキュリティ・アーキテクチャ規約に適合しているかを判断する。

## フロー

1. **規模判定**: Claude（私）が `git diff` で変更量を把握。
2. **レビュー (Claude)**: 以下の「GrowMateレビュー基準」に基づき厳格にレビュー。結果をJSON形式で提示。
3. **差し戻し & 修正 (Codex)**: `ok: false` の場合、Codex（`codex exec`）に対し JSON の `issues` をそのまま渡し、修正を指示。
4. **合格**: `ok: true` になるまで繰り返す。

## 停止条件

- `ok: true` 獲得
- `max_iters` (5回) 到達
- **テスト2回連続失敗** (プロジェクトのテストスイート `npm test` 等が実行可能な場合):
  - 各修正後にテストを実行し、同一または新規のテストエラーが2回連続で解消されない場合は、ループを中断し人間へ報告。

## GrowMateレビュー基準

- **Google Ads API**: 認証情報の漏洩がないか、レート制限やエラーハンドリングが適切か。
- **Next.js/React**: サーバー/クライアントコンポーネントの分離、パフォーマンス（再レンダリング防止）。
- **AI Fallback**: 回避ロジックが不必要に発火していないか、精度が保証されているか。
- **UI/UX**: Tailwind CSS のクラス指定が、GrowMateのプレミアムデザインガイド（ガラスモフィズム、適切な配色）に沿っているか。

## レビューレポート (JSON出力)

Claudeはレビュー後、必ず以下のJSONを生成し、自身の思考の終わりに含める。

```json
{
  "ok": true,
  "summary": "レビューの要約",
  "issues": [
    {
      "severity": "blocking",
      "category": "logic",
      "file": "path/to/file",
      "lines": "開始-終了",
      "problem": "具体的な問題点",
      "recommendation": "Codexへの修正指示（コード例を含む）"
    }
  ],
  "notes_for_next_codex_run": "次回のCodex実行時に渡すべき追加コンテキスト"
}
```

### フィールド仕様

- `ok` (boolean, 必須): レビュー合格の可否。`blocking` な問題が1件でもある場合は `false`。
- `summary` (string, 必須): レビュー全体の要約（最大500文字）。
- `issues` (array, 必須): 問題のリスト。`ok: true` の場合は空配列 `[]` とすること。
- `notes_for_next_codex_run` (string, 任意): 次回のCodex実行時に渡すべき追加コンテキスト。

#### Issue オブジェクト

- `severity` (string, 必須):
  - `"blocking"`: 修正必須。`ok: false` となる。
  - `"major"`: 重要な改善・警告。
  - `"minor"`: 軽微な指摘。
  - `"info"`: 参考情報。
- `category` (string, 必須):
  - `"security"`: セキュリティ脆弱性。
  - `"logic"`: ロジックエラー、バグ、仕様不備。
  - `"ui"`: UI/UX、CSS（Tailwind）の指摘。
  - `"perf"`: パフォーマンス、再レンダリング。
- `file` (string, 必須): 指摘対象のファイルパス。
- `lines` (string, 必須): 指摘箇所の行範囲（形式: `"開始-終了"`）。
- `problem` (string, 必須): 問題の具体的な説明。
- `recommendation` (string, 必須): Codexへの修正指示、または具体的な改善コード例。

## Codexへの修正指示コマンド例

`ok: false` 時、Claudeは以下のようなコマンドを構築してCodexを実行させる。

```bash
codex exec --full-auto --cd . "以下のレビュー結果に基づき、コードを修正してください。修正が完了するまで再試行してください。[レビューレポートのJSONを添付]"
```

## 終了レポート

監査完了後、以下の項目を報告する。

- **レビューサマリー**: パス/リジェクトの理由。
- **修正履歴**: Codexに修正させた箇所の要約。
- **Advisory**: 修正必須ではないが改善が望ましい点。
