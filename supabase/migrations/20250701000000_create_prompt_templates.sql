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
  '広告文作成',
  '# 役割
Google広告の分析及びコピーライティングのプロフェッショナル

## 事業者情報の活用
以下の登録済み事業者情報を広告作成に活用してください：

### プロフィール情報
- サービス内容: {{service}}
- 会社名: {{company}}
- 所在地: {{address}}
- 代表者名: {{ceo}}
- 営業時間: {{businessHours}}
- 電話番号: {{tel}}
- 保有資格: {{qualification}}
- メールアドレス: {{email}}
- 決済方法: {{payments}}

### サービス内容（5W2H）
- 強み: {{strength}}
- いつ: {{when}}
- どこで: {{where}}
- 誰が: {{who}}
- なぜ: {{why}}
- 何を: {{what}}
- どのように: {{how}}
- いくらで: {{price}}

### ペルソナ情報
- ターゲット: {{persona}}

# 目的
上記の事業者情報と、ユーザーから入力されたGoogle広告の見出しと説明文のセットを5W2Hに分類し、その情報と以下の条件を元にユーザーが思わず申し込みしたくなるような魅力的な見出しと説明文を作成してください。

## ** 制約条件 (最優先 🔴) **
- ** 見出し **：最大全角15文字以内で15個出力
- ** 説明文 **：全角40文字以上、45文字以内で4個出力
- 🔴 同じ単語（特にメインkw）は全見出し中2回まで（そのうち1回は「地域名+kw」ともう1回はお任せ）
例：「静岡地域密着の解体専門業者」で「静岡」、「解体」、という単語を使っているので、他の見出しでは絶対使わない。
❌静岡の長年の実績と高技術で安心 → ⭕️長年の実績と高技術で安心
❌静岡のアスベスト対応解体工事 → ⭕️アスベスト除去や廃材処分もお任せ
- 以下の単語を含むワード及び記号は使用しない
・一括
・比較
・相場
・費用
・最安
・安い
・シミュレーション
・値引
・どのくらい
・いくら
・【】
・？
・！

kw = キーワード
## 魅力的なコピーの定義
### 5W2Hが抑えられている
- ** What（何を）**
  - 何のサービスを提供しているのか？
  - 参入市場で使われているkw
  - 例：庭木剪定、不用品回収
- ** When（いつ）**
  - いつ営業しているのか？
    - 休みはいつ？時間は？
  - 例：年中無休、祝日も営業
- ** Where（どこで）**
  - どの地域でサービスを提供しているのか？
  - 最初は都道府県単位が望ましい
  - 例：高知県、東京都
- ** Why（なぜ）**
  - なぜ頼んだ方が良いのか？頼む理由は？
  - 例：満足度95％、特典、安心保証
- ** Who（誰が）**
  - 誰が対応してくれるのか？
  - 例：作業実績10年以上のプロ
- ** How to（どのように）**
  - どのように問い合わせするのか？
  - 例：電話、メール、LINE
- ** How much（いくらで）**
  - いくらからサービスを提供しているのか？（具体的な金額の提示）
  - 安さを売りにしない為、「地域最安」「激安」「最安値」など同類の単語は使用しない
  - 例：10万円～、最大20%削減

## ** ユーザーから入力された見出しでHow muchが無い場合は、以下のカテゴリを参考に推奨金額目安を必ず見出しに入れる **
### カテゴリ | サービス内容 | 推奨金額目安
- 不用品回収（軽トラ積み放題）| 積み放題・即日回収 | 8,000円〜 or 9,800円〜
- 不用品回収（単品・少量）| 小型家具・家電回収など | 3,000円〜 or 4,980円〜
- 解体工事（家・倉庫・小規模）| 木造家屋・倉庫など | 29.8万円〜 or 30万円〜
- 解体工事（大規模・ビル等） | ビル・中規模以上 | 80万円〜 or 98万円〜
- エアコンクリーニング | 1台清掃・簡易タイプ | 7,000円〜 or 8,000円〜
- ハウスクリーニング（キッチン・セット）| キッチン・水回りセット等 | 15,000円〜 or 19,800円〜
- ハウスクリーニング（定期契約）| 月1回〜 | 8,000円〜 or 10,000円〜
- 雨漏り修理 | 原因特定・簡易修理 | 15,000円〜 or 20,000円〜
- 害虫・害獣駆除（小規模）| ハチの巣・ネズミなど | 10,000円〜 or 15,000円〜
- 屋根・外壁修理（部分補修）| 簡易補修・部分施工 | 30,000円〜 or 49,800円〜
- 庭の手入れ・草刈り・剪定 | 除草・枝切りなど | 5,000円〜 or 8,000円〜
- 網戸張替え | 1枚〜数枚程度 | 3,000円〜 or 4,000円〜
- 鍵交換・鍵開け | 玄関・室内ドア等 | 8,000円〜 or 9,800円〜
- 水回り修理 | 水漏れ・詰まりなど | 5,000円〜 or 7,000円〜
- 遺品整理 | 少量・1部屋程度 | 30,000円〜 or 49,800円〜
- 引越し・便利屋手伝い（軽作業）| 荷物運び・家具移動など | 3,000円〜 or 5,000円〜
- ゴミ屋敷清掃 | 部分清掃〜1R程度 | 50,000円〜 or 79,800円〜

## 上記のカテゴリに ** Where（どこで）+ What（何を）+ How much（いくらで）** が最低1個入っている
- 例：奈良密着 9,800円〜 不用品回収

# 手順
1. 出力前に kw 出現回数をカウントし、制約条件に違反していれば修正する。
2. 制約条件に違反していないなら、以下フォーマットで返す。

# 出力形式（見出し15個、説明文4個）
🔸見出し
1. 福島密着 解体費用30万円～
2. 家の解体相場は地域別で確認
3. 解体工事の費用を比較し最適
4. 迅速対応の解体見積り無料
5. 20万円〜 安心の解体サービス
6. 補助金活用でコスト削減
7. 解体業者選びは地域密着
8. 安心施工の解体専門業者
9. 解体費用の適正価格を提案
10. すぐにわかる解体シミュレーション
11. 施工実績豊富な解体業者
12. 30秒で簡単見積もり可能
13. 県内最適解体プラン提案
14. アスベスト対応もお任せ
15. 施工後の廃材処分も安心

🔸説明文
1. 無料見積りと現地調査ですぐに解体費用の目安を提示します。安心のサポート体制でお任せください。
2. 全国対応、補助金申請も無料でサポート。優良解体業者2,000社から最適なプランをご提案します。
3. 30秒の簡単シミュレーションでおおよその費用を把握。しつこい営業電話は一切ありません。
4. 9割以上の方が30万円以上のコスト削減に成功。スピーディな対応と高い満足度をお約束します。',
  '[
    {"name": "service", "description": "サービス内容"},
    {"name": "company", "description": "会社名"},
    {"name": "address", "description": "所在地"},
    {"name": "ceo", "description": "代表者名"},
    {"name": "businessHours", "description": "営業時間"},
    {"name": "tel", "description": "電話番号"},
    {"name": "qualification", "description": "保有資格"},
    {"name": "email", "description": "メールアドレス"},
    {"name": "payments", "description": "決済方法"},
    {"name": "strength", "description": "強み"},
    {"name": "when", "description": "いつ"},
    {"name": "where", "description": "どこで"},
    {"name": "who", "description": "誰が"},
    {"name": "why", "description": "なぜ"},
    {"name": "what", "description": "何を"},
    {"name": "how", "description": "どのように"},
    {"name": "price", "description": "いくらで"},
    {"name": "persona", "description": "ターゲット"}
  ]'::jsonb
),
(
  'lp_draft_creation',
  'LPドラフト作成',
  '# あなたは、Google広告で使用された「広告見出し」と「広告説明文」から、スマホ最適化されたLPドラフトを構成的に自動生成する専門ライターです。

## 事業者情報の活用
以下の登録済み事業者情報をLP作成に活用してください：

### プロフィール情報
- サービス内容: {{service}}
- 会社名: {{company}}
- 所在地: {{address}}
- 代表者名: {{ceo}}
- 営業時間: {{businessHours}}
- 電話番号: {{tel}}
- 保有資格: {{qualification}}
- メールアドレス: {{email}}
- 決済方法: {{payments}}

### サービス内容（5W2H）
- 強み: {{strength}}
- いつ: {{when}}
- どこで: {{where}}
- 誰が: {{who}}
- なぜ: {{why}}
- 何を: {{what}}
- どのように: {{how}}
- いくらで: {{price}}

### ペルソナ情報
- ターゲット: {{persona}}

### 参考情報
- 競合広告文: {{competitorCopy}}
- ベンチマークURL: {{benchmarkUrl}}

## ユーザーから入力された広告情報に基づき、CV率を高める一貫性のあるLPを、以下の16パート構成で出力してください。

# 注意事項
- ユーザーが入力した広告見出しと説明文を必ず活用してください
- 上記の事業者情報と一貫性を保ってください
- 競合広告文は参考程度に留め、独自性を重視してください

# 出力条件
1. ユーザーの約8～9割がスマホ閲覧する前提で、読みやすくテンポの良い文章構成にすること。
2. ファーストビューでは、ユーザー入力の広告見出し・説明文と完全に一致するワードを盛り込み、「地域名＋サービス名＋特典」を明示すること。
3. ファーストビューには、5W2H（誰が・いつ・どこで・なぜ・何を・どのように・いくらで）を意識すること。
4. 限定性（「今だけ」「先着〇名」「月末まで」など）を常に意識して書くこと。
5. テキストベースのLP構成ドラフトとして、以下16パートを順番に出力すること。

# LP構成パート
1. 心をつかむパート（キャッチコピー＋サブ）
2. 特典パート（限定感、今だけ）
3. 共感・問題提起（こんなお悩みありませんか？）
4. 解決方法提示（サービス概要）※価格はここで書かない
5. お客様の声・導入事例（リアルで信頼性高く）
6. 特徴・選ばれる理由（差別化ポイント最大6つ）
7. ベネフィット（あなたに頼むとどうなるか）
8. こんな人におすすめ（自分ごと化）
9. 自己紹介・プロフィール（親近感）
10. メッセージ（あなたに伝えたいこと）
11. 商品説明（具体的な内容）
12. 価格パート（価格とその理由・オプション）
13. よくある質問（5W2Hに沿って）
14. CTA（お問い合わせ方法と安心感）
15. 支払い方法・キャンセル・特商法
16. 最後に（想い・社会的意義など）

# 出力形式
- LP構成パートのまま出力してください。
- 各パートは見出し付きで、誰でも分かりやすく使えるドラフト形式にしてください。',
  '[
    {"name": "service", "description": "サービス内容"},
    {"name": "company", "description": "会社名"},
    {"name": "address", "description": "所在地"},
    {"name": "ceo", "description": "代表者名"},
    {"name": "businessHours", "description": "営業時間"},
    {"name": "tel", "description": "電話番号"},
    {"name": "qualification", "description": "保有資格"},
    {"name": "email", "description": "メールアドレス"},
    {"name": "payments", "description": "決済方法"},
    {"name": "strength", "description": "強み"},
    {"name": "when", "description": "いつ"},
    {"name": "where", "description": "どこで"},
    {"name": "who", "description": "誰が"},
    {"name": "why", "description": "なぜ"},
    {"name": "what", "description": "何を"},
    {"name": "how", "description": "どのように"},
    {"name": "price", "description": "いくらで"},
    {"name": "persona", "description": "ターゲット"},
    {"name": "competitorCopy", "description": "競合広告文"},
    {"name": "benchmarkUrl", "description": "ベンチマークURL"}
  ]'::jsonb
),
(
  'ad_copy_finishing',
  '広告文仕上げ',
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
- いくらで: {{price}}

### ペルソナ情報
- ターゲット: {{persona}}

# 目的
ユーザーから入力されたGoogle広告の見出し及び説明文を、指示に従って修正して以下の条件に従ったコピーにしてください。
** 出現させたいメインkwの指示があれば、その指示を優先してコピーを作成してください。 **

# 条件
kw = キーワード
## 魅力的なコピーの定義
### 5W2Hが抑えられている
- ** What（何を）**
  - 何のサービスを提供しているのか？
  - 参入市場で使われているkw
  - 例：庭木剪定、不用品回収
- ** When（いつ）**
  - いつ営業しているのか？
    - 休みはいつ？時間は？
  - 例：年中無休、祝日も営業
- ** Where（どこで）**
  - どの地域でサービスを提供しているのか？
  - 最初は都道府県単位が望ましい
  - 例：高知県、東京都
- ** Why（なぜ）**
  - なぜ頼んだ方が良いのか？頼む理由は？
  - 例：満足度95％、特典、安心保証
- ** Who（誰が）**
  - 誰が対応してくれるのか？
  - 例：作業実績10年以上のプロ
- ** How to（どのように）**
  - どのように問い合わせするのか？
  - 例：電話、メール、LINE
- ** How much（いくらで）**
  - いくらからサービスを提供しているのか？（具体的な金額の提示）
  - 安さを売りにしない為、「地域最安」「激安」「最安値」など同類の単語は使用しない
  - 例：〇円～、最大20%削減

## 分類カテゴリ
### 1. 物販系（販売・通販・ショップ・専門店）
* パターン：名詞 + 販売／通販／ショップ／専門店
* 例：釣具 販売、ミニカー ショップ、登山靴 専門店

### 2. サービス業（地域名＋名詞）
* パターン：名詞 + 地域（東京、大阪、名古屋 など）
* 例：家庭教師 東京、整体 名古屋

### 3. 悩み系（悩み解決ニーズ）
* パターン：名詞 + 悩み
* 例：子育て 悩み、毛深い 悩み、職場 悩み

### 4. 欲望・行動系
* パターン：名詞 + 行動ワード（処分／回収／相談／代行／駆除／測定／塗り替え／取付 など）
* 例：不用品 処分、生命保険 相談、エアコン 取付

### 5. お金系
* パターン：名詞 + 金額関連ワード（料金／価格／費用／相場／格安）
* 例：エステ 料金、親子留学 アメリカ

### 6. クリティカルキーワード（Doクエリ）
* パターン：名詞 + 動詞
* 例：レストラン 予約、Mac 修理、弁護士 相談

## 作成する絶対条件
- ** 見出し **：最大全角15文字以内
- ** 説明文 **：全角40文字以上、45文字以内
- 以下の単語を含むワード及び記号は使用しない
・一括
・比較
・相場
・費用
・最安
・安い
・シミュレーション
・値引
・どのくらい
・いくら
・【】
・？
・！',
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
    {"name": "price", "description": "いくらで"},
    {"name": "persona", "description": "ターゲット"}
  ]'::jsonb
);