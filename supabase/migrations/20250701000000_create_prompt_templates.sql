-- プロンプトテンプレート管理テーブル
CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE, -- 'ad_copy_creation', 'lp_draft_creation'
  display_name VARCHAR(255) NOT NULL, -- '広告コピー作成プロンプト'
  content TEXT NOT NULL, -- プロンプト本文
  variables JSONB DEFAULT '[]', -- [{"name": "service", "description": "サービス内容"}]
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- バージョン履歴テーブル
CREATE TABLE prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES prompt_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  change_summary TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS設定
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;

-- 管理者のみアクセス可能
CREATE POLICY "管理者のみアクセス可能_prompt_templates" ON prompt_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "管理者のみアクセス可能_prompt_versions" ON prompt_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- インデックス最適化
CREATE INDEX idx_prompt_templates_name ON prompt_templates(name);
CREATE INDEX idx_prompt_templates_active ON prompt_templates(is_active);
CREATE INDEX idx_prompt_versions_template ON prompt_versions(template_id, version DESC);

-- 初期データ投入（既存のプロンプトを移行）
INSERT INTO prompt_templates (name, display_name, content, variables) VALUES 
(
  'ad_copy_creation',
  '広告コピー作成プロンプト',
  'あなたは優秀なマーケティングコピーライターです。以下の情報を基に、魅力的で効果的な広告コピーを作成してください。

## 事業者情報
- 業種: {{business_type}}
- サービス: {{service_name}}
- ターゲット顧客: {{target_audience}}
- エリア: {{service_area}}

## 広告コピー作成条件
1. キャッチーで印象に残るタイトル
2. ユーザーのニーズに直結したメッセージ
3. 行動を促すCTA（コールトゥアクション）
4. 競合との差別化要素

## 出力形式
以下の形式で3パターン提案してください：

**パターン1:**
- タイトル: [30文字以内]
- 本文: [90文字以内]
- CTA: [15文字以内]

**パターン2:**
- タイトル: [30文字以内] 
- 本文: [90文字以内]
- CTA: [15文字以内]

**パターン3:**
- タイトル: [30文字以内]
- 本文: [90文字以内]
- CTA: [15文字以内]',
  '[
    {"name": "business_type", "description": "事業者の業種"},
    {"name": "service_name", "description": "提供サービス名"},
    {"name": "target_audience", "description": "ターゲット顧客層"},
    {"name": "service_area", "description": "サービス提供エリア"}
  ]'::jsonb
),
(
  'lp_draft_creation',
  'ランディングページ原稿作成プロンプト',
  'あなたはWeb制作とマーケティングに精通したコピーライターです。以下の情報を基に、コンバージョン率の高いランディングページの構成と原稿を作成してください。

## 事業者情報
- 業種: {{business_type}}
- サービス: {{service_name}}
- ターゲット顧客: {{target_audience}}
- エリア: {{service_area}}
- 競合他社との差別化ポイント: {{differentiation}}

## ランディングページ構成

### 1. キャッチコピー（ファーストビュー）
- メインキャッチ: [30文字以内]
- サブキャッチ: [50文字以内]

### 2. 問題提起・共感
[ターゲット顧客の悩みや課題を明確にし、共感を得る文章]

### 3. 解決策の提示
[サービスがどのように問題を解決するかを説明]

### 4. サービスの特徴・メリット
[3つの主要な特徴とメリットを箇条書きで]

### 5. 実績・信頼性
[実績や資格、お客様の声など信頼性を高める要素]

### 6. 料金・プラン
[分かりやすい料金体系の提示]

### 7. よくある質問
[想定される質問3つとその回答]

### 8. CTA（お問い合わせ・申し込み）
[行動を促す文言とボタンテキスト]

各セクションごとに具体的な文章を作成し、SEOを意識したキーワードも自然に盛り込んでください。',
  '[
    {"name": "business_type", "description": "事業者の業種"},
    {"name": "service_name", "description": "提供サービス名"},
    {"name": "target_audience", "description": "ターゲット顧客層"},
    {"name": "service_area", "description": "サービス提供エリア"},
    {"name": "differentiation", "description": "競合他社との差別化ポイント"}
  ]'::jsonb
),
(
  'ad_copy_finishing',
  '広告コピー仕上げプロンプト',
  '# 役割
Google広告のコピーライティングプロフェッショナル

## 事業者情報の活用
以下の登録済み事業者情報を広告修正に活用してください：

### プロフィール情報
- サービス内容: {{service}}
- 会社名: {{company}}
- 所在地: {{address}}
- 営業時間: {{businessHours}}
- 電話番号: {{tel}}
- 保有資格: {{qualification}}
- 決済方法: {{payments}}

### サービス内容（5W2H）
- 強み: {{strength}}
- いつ: {{when}}
- どこで: {{where}}
- 誰が: {{who}}
- なぜ: {{why}}
- 何を: {{what}}
- どのように: {{how}}
- いくらで: {{howMuch}}

### ペルソナ情報
- ターゲット: {{persona}}

### 参考情報
- ベンチマークURL: {{benchmarkUrl}}

# 修正指針

## 1. 事業者情報との一貫性
- 上記の事業者情報と矛盾しない内容に修正
- サービスの特徴や強みを適切に反映
- 対応地域や営業時間などの具体情報を活用

## 2. 広告効果の最大化
- より魅力的で行動を促すコピーに改善
- ターゲット顧客（ペルソナ）に響く表現に調整
- 競合との差別化要素を強調

## 3. Google広告ガイドライン準拠
- 文字数制限を遵守（見出し：30文字、説明文：90文字）
- 誇大表現や薬機法に抵触する表現を避ける
- 読みやすく自然な日本語に調整

## 4. CTA（行動喚起）の強化
- 具体的で行動しやすいCTAに改善
- 緊急性や限定性を適切に表現
- 問い合わせや予約につながる文言に調整

# 出力形式
修正前後を比較できる形で以下のように出力：

## 修正結果

**【修正前】**
[元の広告コピー]

**【修正後】**
- 見出し1: [30文字以内]
- 見出し2: [30文字以内]
- 説明文1: [90文字以内]
- 説明文2: [90文字以内]

## 修正理由
1. [修正点1の説明]
2. [修正点2の説明]
3. [修正点3の説明]

## 追加提案
[さらなる改善案があれば記載]

# 注意事項
- 事業者情報が未登録の場合は、ユーザーに情報提供を求める
- 法的リスクのある表現は必ず修正する
- ターゲット顧客に響く感情的な訴求も重視する
- 上記の事業者情報と一貫性を保ってください
- 競合広告文は参考程度に留め、独自性を重視してください',
  '[
    {"name": "service", "description": "サービス内容"},
    {"name": "company", "description": "会社名"},
    {"name": "address", "description": "所在地"},
    {"name": "businessHours", "description": "営業時間"},
    {"name": "tel", "description": "電話番号"},
    {"name": "qualification", "description": "保有資格"},
    {"name": "payments", "description": "決済方法"},
    {"name": "strength", "description": "強み"},
    {"name": "when", "description": "いつ"},
    {"name": "where", "description": "どこで"},
    {"name": "who", "description": "誰が"},
    {"name": "why", "description": "なぜ"},
    {"name": "what", "description": "何を"},
    {"name": "how", "description": "どのように"},
    {"name": "howMuch", "description": "いくらで"},
    {"name": "persona", "description": "ターゲット"},
    {"name": "benchmarkUrl", "description": "ベンチマークURL"}
  ]'::jsonb
);