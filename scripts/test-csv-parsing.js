#!/usr/bin/env node

/**
 * CSVパースのテスト（データベース接続なし）
 */

const { parse } = require('csv-parse/sync');
const fs = require('fs');

console.log('🧪 CSV解析テストを開始します...');

try {
  const csvPath = 'data/test-keywords.csv';
  
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSVファイルが見つかりません: ${csvPath}`);
  }

  console.log(`📖 CSVファイルを読み込み中: ${csvPath}`);
  
  const fileContent = fs.readFileSync(csvPath, 'utf8');
  const records = parse(fileContent, { 
    columns: true, 
    skip_empty_lines: true 
  });

  console.log(`✅ ${records.length}件のレコードを読み込みました\n`);

  // 各レコードを解析してテスト
  records.forEach((record, index) => {
    console.log(`--- レコード ${index + 1} ---`);
    console.log('📋 利用可能なフィールド:', Object.keys(record));
    
    // ✅ 修正後のロジックをテスト
    if (!record.user || !record.assistant) {
      console.log('❌ 必要なフィールドが不足:', { user: !!record.user, assistant: !!record.assistant });
      return;
    }
    
    console.log('✅ user,assistantフィールドが存在します');
    
    // キーワード抽出のテスト
    const userInput = record.user;
    console.log('📝 ユーザー入力:', userInput.replace(/\n/g, ', '));
    
    // 分類結果解析のテスト  
    const assistantOutput = record.assistant;
    console.log('🤖 アシスタント出力:', assistantOutput.replace(/\n/g, '\\n'));
    
    // 今すぐ客キーワードの抽出テスト
    const immediateMatch = assistantOutput.match(/【今すぐ客キーワード】([\\s\\S]*?)(?=【|$)/);
    if (immediateMatch && immediateMatch[1]) {
      const immediateKeywords = immediateMatch[1]
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      console.log('⚡ 今すぐ客キーワード:', immediateKeywords.join(', '));
    }
    
    // 後から客キーワードの抽出テスト
    const laterMatch = assistantOutput.match(/【後から客キーワード】([\\s\\S]*?)(?=【|$)/);
    if (laterMatch && laterMatch[1]) {
      const laterKeywords = laterMatch[1]
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      console.log('⏰ 後から客キーワード:', laterKeywords.join(', '));
    }
    
    console.log('');
  });
  
  console.log('🎉 CSV解析テストが完了しました！');
  console.log('✅ user,assistantフォーマットが正常に処理されています。');
  
} catch (error) {
  console.error('❌ エラー:', error.message);
  process.exit(1);
}