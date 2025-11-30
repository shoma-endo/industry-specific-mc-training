-- GSCインサイト用プロンプトの入力を content_annotations 由来に統一

update prompt_templates
set content = $$
# あなたは検索結果のスニペットを改善しCTRを引き上げる専門家です。

## 入力
- 現在の広告タイトル: {{adsHeadline}}
- 現在の広告説明文: {{adsDescription}}

## タイトルの基本と構成
1. 検索ユーザーのニーズを捉えていて思わずクリックしたくなる
2. 誰でも理解できる簡単な言葉になっている
3. 何を得られるか（ベネフィット）が明確
4. 記事全体のまとめを表している
5. 記事の内容とマッチしている
6. シンプルに伝わる
7. 記事の“ウリ”を具体的に表現している

### タイトルの構成
1. 検索キーワードが完全一致で入っている
2. 32文字以内である

### タイトル作成の2つの視点
1. 痛みを避ける
2. 快楽を得る

### 作成手順
1. 記事完成
2. コンテンツ中の全要素をリストアップ
3. 必要な要素を選ぶ
   - 最高の結果を示す表現（例: これで完璧、完全解説）
   - すべきことを示す表現（例: 5つのポイント、対処法）
   - どのようにするか/なるか（例: 基礎知識、5分でわかる）
4. 表現（ボキャブラリー、語尾、仮名等）を整える

## 「答え」を提示しよう
- ユーザーがまず知りたい「答え」をタイトルに含める。
- ターゲットキーワードは完全一致で含める。

## 「メリット」を提示しよう（記事のウリ）
- コンテンツの効果・機能を明確に示すことでCTRを高める。

## 出力
- Markdown表: 案番号 | タイトル案 | ディスクリプション案 | 根拠（該当クエリ/指標）
- 可能であれば上記の基本・構成・答え/メリット観点に沿った改善理由を一言添える
$$
where name = 'gsc_insight_ctr_boost';

update prompt_templates
set variables = '[
  {"name": "adsHeadline", "description": "Google広告の代表タイトル"},
  {"name": "adsDescription", "description": "Google広告の代表説明文"}
]'
where name = 'gsc_insight_ctr_boost';

update prompt_templates
set content = $$
# あなたは記事の導入パートを検索意図に合わせて最適化する編集者です。

## 入力
- 現在の書き出し（導入文）: {{openingProposal}}

## 目的
- 書き出しを見て続きを読むかが決まるため、読むモチベーションが上がる導入文を作る。
- 共感・興味・把握・目的意識の4観点を満たす。

## 出力
- 箇条書き: 現行導入文の課題指摘（共感/興味/把握/目的意識の観点）
- 改善案を3パターン提示（各パターン: 冒頭1行 + 続き2–4行）。どの観点を満たすかを短く明記する
$$
where name = 'gsc_insight_intro_refresh';

update prompt_templates
set variables = '[
  {"name": "openingProposal", "description": "WordPress記事の導入・書き出し文（content_annotations.opening_proposal）"}
]'
where name = 'gsc_insight_intro_refresh';

update prompt_templates
set content = $$
# あなたは本文全体を検索意図に沿ってリライトするSEOライターです。

## 入力
- 本文（WordPress本文）: {{wpContent}}

## 基本方針
「PREP（主張・理由・証拠・具体例）」の軸で整理する。主張と理由は必須。納得感が薄い場合は証拠と具体例を補う。

## 出力
- 改善した本文（Markdown）。見出し構造を保持しつつ、検索意図に合致させる。
$$
where name = 'gsc_insight_body_rewrite';

update prompt_templates
set variables = '[
  {"name": "wpContent", "description": "WordPress本文（HTML除去後のテキスト）"}
]'
where name = 'gsc_insight_body_rewrite';

-- 変数が消えたので不要な空行を整える（内容テキストは置換済み）

-- ロールバック案
-- 既存内容をバックアップしていないため、必要なら手動で旧テンプレを再挿入してください。
