-- Add gsc_insight_persona_rebuild prompt template
-- GSC改善提案のステージ4用プロンプト（ペルソナから全て変更）

INSERT INTO prompt_templates (name, display_name, content, variables) VALUES
(
  'gsc_insight_persona_rebuild',
  'GSC: ペルソナから全て変更',
  'あなたはプロのマーケティング戦略プランナーです。

以下の情報をもとに、ペルソナ（想定ユーザー像）とそのデモグラフィック情報を作成してください。

ターゲット情報（存在する場合のみ値が入ります）：
{{persona}}

ニーズ情報（存在する場合のみ値が入ります）：
{{contentNeeds}}

上記情報がどちらか一方、または両方存在しない場合は、
与えられた情報をもとに推測し、妥当と思われる一般的なペルソナを設定してください。

3つの異なるペルソナ案を提示し、その中から「最も理想的」と思われるペルソナを最後に1つ選定してください。

【出力形式】
1️⃣ ペルソナ案1
- 名前（仮名）：
- 年齢：
- 性別：
- 職業／立場：
- 特徴：
- 主なニーズ・課題：

2️⃣ ペルソナ案2
（同上）

3️⃣ ペルソナ案3
（同上）

✨ 理想のペルソナ（選定理由を含む）
- ペルソナ名：
- 年齢／性別：
- 職業・立場：
- 選定理由：',
  '[
    {"name": "persona", "description": "ペルソナ情報"},
    {"name": "contentNeeds", "description": "ニーズ情報"}
  ]'::jsonb
);

-- Rollback instructions:
-- DELETE FROM prompt_templates WHERE name = 'gsc_insight_persona_rebuild';
