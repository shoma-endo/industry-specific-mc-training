#!/usr/bin/env node

/**
 * CSVデータクリーニングスクリプト
 * 混在するデータ形式を統一した user,assistant フォーマットに変換
 */

const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const fs = require('fs');

console.log('🧹 CSVデータクリーニングを開始します...');

try {
  const inputPath = 'data/【キーワード用】ファインチューニングサンプル  - キーワードリスト.csv';
  const outputPath = 'data/cleaned-keywords.csv';

  if (!fs.existsSync(inputPath)) {
    throw new Error(`入力ファイルが見つかりません: ${inputPath}`);
  }

  console.log(`📖 CSVファイルを読み込み中: ${inputPath}`);

  const fileContent = fs.readFileSync(inputPath, 'utf8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`📊 ${records.length}件のレコードを読み込みました`);

  const cleanedRecords = [];
  let processedCount = 0;
  let skippedCount = 0;

  records.forEach((record, index) => {
    try {
      // Type 1: 正しい【今すぐ客キーワード】/【後から客キーワード】形式
      if (
        record.user &&
        record.assistant &&
        record.assistant.includes('【今すぐ客キーワード】') &&
        record.assistant.includes('【後から客キーワード】')
      ) {
        // 過度に長いデータを除外（50キーワード以上）
        const keywordCount = (record.user.match(/\n/g) || []).length + 1;
        if (keywordCount <= 50) {
          cleanedRecords.push({
            user: record.user.trim(),
            assistant: record.assistant.trim(),
          });
          processedCount++;
        } else {
          console.log(`⚠️  行${index + 1}: 長すぎるため除外（${keywordCount}キーワード）`);
          skippedCount++;
        }
        return;
      }

      // Type 2: 単一キーワード + 分類フラグ形式を変換
      if (
        record.user &&
        record.assistant &&
        (record.assistant === '今すぐ客キーワード' || record.assistant === '後から客キーワード')
      ) {
        const keyword = record.user.trim();

        if (keyword.length > 0 && keyword.length < 100) {
          // 適切な長さのキーワードのみ
          const assistantContent =
            record.assistant === '今すぐ客キーワード'
              ? `【今すぐ客キーワード】\n${keyword}\n\n【後から客キーワード】\n`
              : `【今すぐ客キーワード】\n\n【後から客キーワード】\n${keyword}`;

          cleanedRecords.push({
            user: keyword,
            assistant: assistantContent,
          });
          processedCount++;
        } else {
          skippedCount++;
        }
        return;
      }

      // その他の形式は除外
      skippedCount++;
    } catch (error) {
      console.warn(`⚠️  行${index + 1}の処理中にエラー:`, error.message);
      skippedCount++;
    }
  });

  // 重複データの除去
  const uniqueRecords = [];
  const seenUsers = new Set();

  cleanedRecords.forEach(record => {
    const userKey = record.user.toLowerCase().trim();
    if (!seenUsers.has(userKey)) {
      seenUsers.add(userKey);
      uniqueRecords.push(record);
    }
  });

  console.log(`\n📊 処理結果:`);
  console.log(`- 処理済み: ${processedCount}件`);
  console.log(`- 除外: ${skippedCount}件`);
  console.log(`- 重複削除後: ${uniqueRecords.length}件`);

  if (uniqueRecords.length === 0) {
    throw new Error('変換可能なデータが見つかりませんでした');
  }

  // CSVファイルの生成
  const csvOutput = stringify(uniqueRecords, {
    header: true,
    columns: ['user', 'assistant'],
    quoted: true,
  });

  fs.writeFileSync(outputPath, csvOutput);

  console.log(`\n✅ クリーンなデータを保存しました: ${outputPath}`);
  console.log(`📈 ${uniqueRecords.length}件のデータが使用可能です`);

  // サンプルデータの表示
  console.log('\n📝 サンプルデータ（最初の3件）:');
  uniqueRecords.slice(0, 3).forEach((record, index) => {
    console.log(`\n--- サンプル ${index + 1} ---`);
    console.log(`User: ${record.user.replace(/\n/g, ', ')}`);
    console.log(`Assistant: ${record.assistant.substring(0, 100)}...`);
  });

  console.log('\n🎉 データクリーニングが完了しました！');
  console.log('💡 次のステップ: npm run rag:convert -- -f data/cleaned-keywords.csv');
} catch (error) {
  console.error('❌ エラー:', error.message);
  process.exit(1);
}
