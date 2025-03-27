サンプル
https://docs.google.com/spreadsheets/d/17TqvEPRpIaPYJgSTVavC-dCk8r4UcOtX_Gb4XswYeLA/edit?gid=0#gid=0

# OpenAI ファインチューニングスクリプト

このスクリプトは、OpenAI APIを使用して言語モデルのファインチューニングを行うためのツールです。

## 前提条件

- Node.js 18以上
- OpenAI APIキー（`.env.local`ファイルに`OPENAI_API_KEY`として設定）

## インストール

必要なパッケージをインストールします：

```bash
npm install --save-dev commander dotenv csv-parse csv-stringify
```

## 使い方

### 1. トレーニングデータの準備

CSVデータをOpenAIが要求するJSONL形式に変換します：

```bash
# デフォルト（chat形式）の場合
node scripts/openai-finetune.js prepare -i data/finetune-data.csv -o data/finetune-data.jsonl

# user,system形式の場合（user,systemという列名のCSV）
node scripts/openai-finetune.js prepare -i data/finetune-data.csv -o data/finetune-data.jsonl -f user-system
```

### 2. ファイルのアップロード

準備したトレーニングデータをOpenAIにアップロードします：

```bash
node scripts/openai-finetune.js upload -f data/finetune-data.jsonl
```

### 3. ファインチューニングの作成

ファイルIDを使用してファインチューニングジョブを作成します：

```bash
node scripts/openai-finetune.js create -f file-xxxxxxxxxxxxxxxx
```

追加オプション：

```bash
# カスタムモデル名サフィックスを設定
node scripts/openai-finetune.js create -f file-xxxxxxxxxxxxxxxx -n "自社応対モデル"

# 異なるベースモデルを指定（ファインチューニング対応モデルを使用）
node scripts/openai-finetune.js create -f file-xxxxxxxxxxxxxxxx -m gpt-3.5-turbo-0125

# エポック数を変更
node scripts/openai-finetune.js create -f file-xxxxxxxxxxxxxxxx -e 5
```

### 4. ジョブのステータス確認

ファインチューニングジョブのリストを表示：

```bash
node scripts/openai-finetune.js list
```

特定のジョブの詳細を確認：

```bash
node scripts/openai-finetune.js get -j ft-xxxxxxxxxxxxxxxx
```

### 5. ジョブのキャンセル

進行中のジョブをキャンセルします：

```bash
node scripts/openai-finetune.js cancel -j ft-xxxxxxxxxxxxxxxx
```

## トレーニングデータの形式

### チャット形式のCSV（標準のチャット形式）

```csv
system_prompt,user_message,assistant_message
あなたは親切なアシスタントです。,こんにちは,こんにちは！どのようにお手伝いできますか？
あなたは親切なアシスタントです。,調子はどうですか？,私は元気です。あなたはいかがお過ごしですか？
```

### user-system形式のCSV（ユーザーメッセージとシステムプロンプトのみの形式）

```csv
user,system
こんにちは,あなたは親切なアシスタントです。
調子はどうですか？,あなたは親切なアシスタントです。
```

> **注意:** スクリプトは列名のタイプミス「sysytem」も「system」として認識します。どちらの形式でも処理可能です。

> **重要:** OpenAIのファインチューニング要件では、各トレーニング例の最後のメッセージは必ずアシスタント（assistant）からのものでなければなりません。user-system形式では、自動的にダミーのアシスタント応答が追加されます。実際の用途では、CSVファイルにassistant列を追加し、適切な応答を含めることをお勧めします。

### 補完形式のCSV

```csv
prompt,completion
以下は製品の特徴です：...,どこでも安心、いつでも快適。...
以下の文章を要約してください：...,日本には春夏秋冬の四季があり、...
```

## 注意事項

- ファインチューニングには十分な量のトレーニングデータが必要です（推奨：50例以上）
- ファインチューニングは有料機能です。APIの使用料金が発生します
- 完了までに数時間〜数日かかる場合があります

> **注意:** ファインチューニングはすべてのモデルに対応しているわけではありません。一般的に対応しているモデルは `gpt-3.5-turbo-0125` や `gpt-3.5-turbo-1106` などです。最新の対応モデルについては [OpenAI公式ドキュメント](https://platform.openai.com/docs/guides/fine-tuning) を参照してください。

```

```
