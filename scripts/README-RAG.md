# RAGキーワード分類システム

ファインチューニングモデルからRAGシステムに移行した高精度キーワード分類システムです。

## 🚀 利用方法

### 1. サンプルデータでテスト
```bash
npm run rag:sample
```

### 2. CSVファイルからデータ変換
```bash
npm run rag:convert -- -f データファイル.csv
```

### 3. 統計情報の確認
```bash
npm run rag:stats
```

### 4. データのリセット
```bash
npm run rag:reset
```

### 5. CSV解析テスト
```bash
npm run rag:test
```

## 📋 CSV形式

### サポートされるフォーマット

**user,assistant形式（推奨）:**
```csv
user,assistant
"キーワード1
キーワード2
キーワード3","【今すぐ客キーワード】
キーワード1
キーワード2

【後から客キーワード】
キーワード3
"
```

### サンプルファイル

プロジェクトには `data/test-keywords.csv` にサンプルファイルが含まれています。

## 🔧 システム構成

### データベース

- **rag_training_data**: 訓練データ（複数キーワードのセット）
- **rag_individual_keywords**: 個別キーワード（高速検索用）

### 検索機能

- **ベクトル検索**: OpenAI Embeddings + pgvector
- **フルテキスト検索**: PostgreSQL日本語検索
- **ハイブリッド検索**: 上記2つの組み合わせ

### API

```typescript
// REST API
POST /api/rag/classify-keywords
{
  "keywords": ["東京 ハウスクリーニング", "ハウスクリーニング とは"],
  "options": { "includeEvidence": true }
}

// チャット統合
const model = 'rag_keyword_classifier';
```

## 📊 移行のメリット

1. **保守性向上**: ファインチューニング不要
2. **透明性**: 分類根拠を明示
3. **柔軟性**: 新しいデータ追加が容易
4. **コスト効率**: ファインチューニング費用が不要

## 🛠️ 技術スタック

- **データベース**: Supabase (PostgreSQL + pgvector)
- **AI**: OpenAI Embeddings + GPT-4o-mini
- **検索**: ハイブリッド検索（ベクトル + フルテキスト）
- **フレームワーク**: Next.js + TypeScript

## 📁 ファイル構成

```
src/
├── lib/
│   ├── rag-keyword-classifier.ts    # メイン分類エンジン
│   └── rag-data-initializer.ts      # データ初期化
├── types/
│   └── rag.ts                       # 型定義
└── server/handler/actions/chat/
    └── modelHandlers.ts             # チャット統合

app/api/rag/
└── classify-keywords/
    └── route.ts                     # REST API

scripts/
├── initialize-rag-data.js           # データ初期化スクリプト
├── test-csv-parsing.js             # CSV解析テスト
└── README-RAG.md                   # このファイル

supabase/migrations/
├── 20250627000000_create_rag_tables.sql     # テーブル作成
└── 20250627000001_create_rag_functions.sql  # 検索関数
```

## 🔄 マイグレーション手順

1. **Supabaseマイグレーション実行**
   ```bash
   # マイグレーションファイルをSupabaseに適用
   ```

2. **サンプルデータ作成**
   ```bash
   npm run rag:sample
   ```

3. **既存システムから移行**
   ```bash
   # モデル選択でrag_keyword_classifierを使用
   ```

## ⚠️ 注意事項

- OpenAI APIキーが必要
- Supabase Service Role Keyが必要
- pgvector拡張機能が有効になっている必要があります

## 🐛 トラブルシューティング

### CSV読み込みエラー
```bash
npm run rag:test  # CSVフォーマットをテスト
```

### データベース接続エラー
- `.env.local`の環境変数を確認
- Supabaseの接続情報を確認

### 分類精度が低い場合
- 訓練データを追加
- 類似事例の品質を向上