-- LP改善プロンプトテンプレート追加
INSERT INTO prompt_templates (name, display_name, content, variables) VALUES 
(
  'lp_improvement',
  'LP改善',
  'ユーザーの指示にしたがってLPの内容を改善・修正して下さい。',
  '[]'::jsonb
);