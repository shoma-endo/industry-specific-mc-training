#!/usr/bin/env node

/**
 * RAGDataInitializerの修正をテストするスクリプト
 */

const dotenv = require('dotenv');

// 環境変数の読み込み
dotenv.config({ path: '.env.local' });

async function testRAGInitializer() {
  try {
    console.log('🧪 RAGDataInitializer修正テストを開始します...');
    
    // dynamic importを使用してESM形式のモジュールをインポート
    const { RAGDataInitializer } = await import('../src/lib/rag-data-initializer.js');
    
    const initializer = new RAGDataInitializer();
    
    // テスト用CSVファイルのパス
    const csvFilePath = 'data/test-keywords.csv';
    
    console.log('📖 テスト用CSVファイルを読み込み中...');
    console.log(`📂 ファイルパス: ${csvFilePath}`);
    
    // CSVファイルの読み込みテスト
    await initializer.loadFineTuningData(csvFilePath);
    
    console.log('✅ CSVファイルの読み込みが成功しました！');
    console.log('📊 処理されたデータを確認しています...');
    
    // processedDataの内容を表示（プライベートプロパティなのでreflectionで取得）
    const processedData = initializer.processedData || [];
    
    if (processedData.length === 0) {
      console.log('⚠️  処理されたデータが見つかりません');
      return;
    }
    
    console.log(`\n📈 処理結果: ${processedData.length}件のデータを処理`);
    
    // 各レコードの詳細を表示
    processedData.forEach((data, index) => {
      console.log(`\n--- レコード ${index + 1} ---`);
      console.log(`📝 キーワード数: ${data.keywords.length}`);
      console.log(`🎯 今すぐ客: ${data.classification.immediate.length}件`);
      console.log(`⏰ 後から客: ${data.classification.later.length}件`);
      console.log(`📋 キーワード: ${data.keywords.join(', ')}`);
      
      if (data.classification.immediate.length > 0) {
        console.log(`⚡ 今すぐ客キーワード: ${data.classification.immediate.join(', ')}`);
      }
      
      if (data.classification.later.length > 0) {
        console.log(`⏰ 後から客キーワード: ${data.classification.later.join(', ')}`);
      }
    });
    
    console.log('\n🎉 テストが完了しました！');
    console.log('✅ user,assistantフォーマットのCSVファイルが正常に処理されています。');
    
  } catch (error) {
    console.error('❌ テストエラー:', error.message);
    if (error.details) {
      console.error('詳細:', error.details);
    }
    process.exit(1);
  }
}

// テストを実行
testRAGInitializer();