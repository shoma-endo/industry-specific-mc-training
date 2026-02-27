---
name: codex-review
description: |
  Codexを「監査役（ゲート）」として、比較範囲の特定からレビュー→修正→再レビューまでを反復し、ok:trueまで収束させる最強のレビュースキ。
  Google Ads API/Next.js/AI Fallback等のGrowMate固有コンテキストを常に付与。
  トリガー: "Codexレビュー", "レビューゲート", "品質監査", "最強レビュー"
---

# Codex反復レビューゲート (GrowMate高度監査版)

Codex（監査役/read-only）とClaude Code（修正担当）の連携により、大規模な変更や重要モジュールの品質を極限まで高める。

## フロー概要

1. **規模判定**: `git diff --stat` 等で規模を把握し、戦略（Small/Medium/Large）を選択。
2. **レビュー実行 (Codex)**: `codex exec` を read-only で実行。JSON形式で結果を返却。
3. **修正ループ (Claude Code)**: 指摘に基づき修正 → `ok: true` になるまで反復（最大5回）。

## 規模判定 & 戦略

| 規模       | 基準                    | 戦略                                           |
| ---------- | ----------------------- | ---------------------------------------------- |
| **Small**  | ≤3ファイル、≤100行      | `diff` (直接レビュー)                          |
| **Medium** | 4-10ファイル、100-500行 | `arch` (設計整合性) → `diff`                   |
| **Large**  | >10ファイル、>500行     | `arch` → `diff`並列 → `cross-check` (横断監査) |

## Codex実行ルール (JSON強制)

Claude Codeはプロンプト末尾に必ず以下のスキーマと**GrowMateコンテキスト**を付与する。

### GrowMateコンテキスト

> 「このプロジェクトは Google Ads API を活用した広告運用支援ツール（GrowMate）です。フロントエンドは Next.js、CSS は Tailwind CSS を使用し、AI Fallback 機能を備えた高度なスクレイピング/解析ロジックを含みます。これらを考慮してレビューしてください。」

### JSON形式スキーマ

```json
{
  "ok": true,
  "summary": "要約",
  "issues": [
    {
      "severity": "blocking",
      "category": "logic",
      "file": "path/to/file",
      "lines": "開始-終了",
      "problem": "問題点",
      "recommendation": "修正案（具体的なコード例を含む）"
    }
  ],
  "notes_for_next_review": "以前の文脈"
}
```

### フィールド仕様

- `ok` (boolean, 必須): レビュー合格の可否。`blocking` な問題が1件でもある場合は `false`。
- `summary` (string, 必須): レビュー全体の要約（最大500文字）。
- `issues` (array, 必須): 問題のリスト。`ok: true` の場合は空配列 `[]` とすること。
- `notes_for_next_review` (string, 任意): 次回のレビューで考慮すべき文脈やメモ。

#### Issue オブジェクト

- `severity` (string, 必須):
  - `"blocking"`: 修正必須。`ok: false` となる。
  - `"major"`: 重要な改善・警告。
  - `"minor"`: 軽微な指摘。
  - `"info"`: 参考情報、Good Luck。
- `category` (string, 必須):
  - `"security"`: セキュリティ脆弱性。
  - `"logic"`: ロジックエラー、バグ、仕様不備。
  - `"ui"`: UI/UX、CSS（Tailwind）の指摘。
  - `"perf"`: パフォーマンス、再レンダリング。
- `file` (string, 必須): 指摘対象のファイルパス。
- `lines` (string, 必須): 指摘箇所の行範囲（形式: `"開始-終了"`）。
- `problem` (string, 必須): 問題の具体的な説明。
- `recommendation` (string, 必須): 修正指示、または具体的な改善コード例。

## プロンプトテンプレート

### 1. アーキテクチャ整合性 (arch)

```
以下の変更のアーキテクチャ整合性をレビューせよ。出力はJSON1つのみ。
diff_range: {diff_range}
観点: 依存関係、責務分割、Google Ads API連携の妥当性、セキュリティ設計
前回メモ: {notes_for_next_review}
```

### 2. 詳細レビュー (diff)

```
以下の変更をレビューせよ。出力はJSON1つのみ。
これはレビューゲートとして実行されている。blocking が1件でもあれば ok: false とせよ。
diff_range: {diff_range}, 対象: {target_files}, 観点: {review_focus}
前回メモ: {notes_for_next_review}
```

### 3. 横断チェック (cross-check)

```
並列レビュー結果を統合し、横断的な不整合（interface不整合、認可漏れ、API互換破壊等）をレビューせよ。
全体stat: {stat_output}, 各グループ結果: {group_jsons}
```

## 修正ループ & 停止条件

- `ok: false` の場合、指摘を解析して修正。修正後は再度Codexにレビューを依頼する。
- **停止条件**:
  - `ok: true` 獲得
  - `max_iters` (5回) 到達
  - **テスト2回連続失敗** (プロジェクトのテストスイート `npm test` 等が実行可能な場合):
    - 各修正後にテストを実行し、同一または新規のテストエラーが2回連続で解消されない場合は、ループを中断し人間へ報告。

## 実行手順

1. `git diff` で変更範囲と規模を確認。
2. 上記戦略に基づき、プロジェクトルートを作業ディレクトリとして `codex exec` を実行。
3. 結果をパースし、修正ループを開始。
4. 最終的に「規模」「反復回数」「修正履歴」「Advisory（参考）」「未解決事項」をまとめた完了レポートを提示。
