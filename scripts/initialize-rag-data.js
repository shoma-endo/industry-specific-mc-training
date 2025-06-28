#!/usr/bin/env node

/**
 * RAGキーワード分類システム データ初期化スクリプト
 * 
 * 使用方法:
 * node scripts/initialize-rag-data.js [options]
 * 
 * オプション:
 * --sample-data    サンプルデータのみを作成
 * --csv-file       CSVファイルパスを指定
 * --help           ヘルプを表示
 */

const { Command } = require('commander');
const dotenv = require('dotenv');

// 環境変数の読み込み
dotenv.config({ path: '.env.local' });

const program = new Command();

program
  .name('initialize-rag-data')
  .description('RAGキーワード分類システムのデータ初期化')
  .version('1.0.0');

// サンプルデータ作成コマンド
program
  .command('sample')
  .description('サンプルデータを作成してRAGシステムをテスト')
  .action(async () => {
    try {
      console.log('🚀 RAGサンプルデータ作成を開始します...');
      
      // dynamic importを使用してESM形式のモジュールをインポート
      const { RAGDataInitializer } = await import('../src/lib/rag-data-initializer.js');
      
      const initializer = new RAGDataInitializer();
      
      // サンプルデータの作成
      await initializer.createSampleData();
      
      // 統計情報の表示
      const stats = await initializer.getStatistics();
      console.log('\n📊 データ統計:');
      console.log(`- 総キーワード数: ${stats.total_keywords}`);
      console.log(`- 今すぐ客キーワード: ${stats.immediate_keywords}`);
      console.log(`- 後から客キーワード: ${stats.later_keywords}`);
      
      console.log('\n✅ サンプルデータの作成が完了しました！');
      console.log('💡 テスト用のRAGシステムが利用可能です。');
      
    } catch (error) {
      console.error('❌ エラー:', error);
      process.exit(1);
    }
  });

// CSVデータ変換コマンド
program
  .command('convert')
  .description('CSVファイルからRAGデータベースにデータを変換・保存')
  .requiredOption('-f, --file <path>', 'CSVファイルのパス')
  .action(async (options) => {
    try {
      console.log('🔄 CSVデータの変換を開始します...');
      console.log(`📂 入力ファイル: ${options.file}`);
      
      const { RAGDataInitializer } = await import('../src/lib/rag-data-initializer.js');
      
      const initializer = new RAGDataInitializer();
      
      // 1. CSVファイルの読み込み
      console.log('📖 CSVファイルを読み込み中...');
      await initializer.loadFineTuningData(options.file);
      
      // 2. データ変換・保存
      console.log('💾 RAG用データベースに変換・保存中...');
      await initializer.convertAndStore();
      
      // 3. インデックス作成
      console.log('🔍 インデックスを作成中...');
      await initializer.createIndexes();
      
      // 4. 統計情報の表示
      const stats = await initializer.getStatistics();
      console.log('\n📊 変換完了統計:');
      console.log(`- 総キーワード数: ${stats.total_keywords}`);
      console.log(`- 今すぐ客キーワード: ${stats.immediate_keywords}`);
      console.log(`- 後から客キーワード: ${stats.later_keywords}`);
      console.log(`- サービス種別: ${stats.service_types?.join(', ') || 'なし'}`);
      console.log(`- 地域: ${stats.regions?.join(', ') || 'なし'}`);
      
      console.log('\n✅ CSVデータの変換が完了しました！');
      console.log('🎯 RAGキーワード分類システムが利用可能です。');
      
    } catch (error) {
      console.error('❌ エラー:', error.message);
      if (error.details) {
        console.error('詳細:', error.details);
      }
      process.exit(1);
    }
  });

// 統計情報表示コマンド
program
  .command('stats')
  .description('現在のRAGデータベースの統計情報を表示')
  .action(async () => {
    try {
      console.log('📊 RAGデータベース統計情報を取得中...');
      
      const { RAGDataInitializer } = await import('../src/lib/rag-data-initializer.js');
      
      const initializer = new RAGDataInitializer();
      const stats = await initializer.getStatistics();
      
      if (!stats || stats.total_keywords === 0) {
        console.log('⚠️  RAGデータベースにデータがありません。');
        console.log('💡 先に "sample" または "convert" コマンドでデータを作成してください。');
        return;
      }
      
      console.log('\n📈 RAGデータベース統計:');
      console.log('=' .repeat(40));
      console.log(`📝 総キーワード数: ${stats.total_keywords}`);
      console.log(`⚡ 今すぐ客キーワード: ${stats.immediate_keywords}`);
      console.log(`⏰ 後から客キーワード: ${stats.later_keywords}`);
      
      if (stats.service_types && stats.service_types.length > 0) {
        console.log(`🏢 サービス種別 (${stats.service_types.length}種類):`);
        stats.service_types.forEach(type => console.log(`   - ${type}`));
      }
      
      if (stats.regions && stats.regions.length > 0) {
        console.log(`📍 地域 (${stats.regions.length}地域):`);
        stats.regions.forEach(region => console.log(`   - ${region}`));
      }
      
      console.log(`🕐 最終更新: ${new Date(stats.last_updated).toLocaleString('ja-JP')}`);
      
    } catch (error) {
      console.error('❌ エラー:', error.message);
      process.exit(1);
    }
  });

// データベースリセットコマンド
program
  .command('reset')
  .description('RAGデータベースを初期化（全データ削除）')
  .option('--confirm', '確認なしで実行')
  .action(async (options) => {
    try {
      if (!options.confirm) {
        console.log('⚠️  この操作はRAGデータベースのすべてのデータを削除します。');
        console.log('継続するには --confirm オプションを追加してください。');
        console.log('例: node scripts/initialize-rag-data.js reset --confirm');
        return;
      }
      
      console.log('🗑️  RAGデータベースをリセット中...');
      
      const { createClient } = await import('@supabase/supabase-js');
      
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE
      );
      
      // データの削除
      const { error: deleteTrainingError } = await supabase
        .from('rag_training_data')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // すべて削除
      
      if (deleteTrainingError) {
        throw new Error(`訓練データ削除エラー: ${deleteTrainingError.message}`);
      }
      
      const { error: deleteKeywordError } = await supabase
        .from('rag_individual_keywords')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // すべて削除
      
      if (deleteKeywordError) {
        throw new Error(`キーワードデータ削除エラー: ${deleteKeywordError.message}`);
      }
      
      console.log('✅ RAGデータベースのリセットが完了しました。');
      console.log('💡 新しいデータを作成するには "sample" または "convert" コマンドを実行してください。');
      
    } catch (error) {
      console.error('❌ エラー:', error.message);
      process.exit(1);
    }
  });

// ヘルプの拡張
program
  .addHelpText('after', `

使用例:
  $ node scripts/initialize-rag-data.js sample
    サンプルデータでRAGシステムをテスト

  $ node scripts/initialize-rag-data.js convert -f data/keywords.csv
    CSVファイルからRAGデータを作成

  $ node scripts/initialize-rag-data.js stats
    現在のデータ統計を表示

  $ node scripts/initialize-rag-data.js reset --confirm
    すべてのRAGデータを削除

環境変数:
  NEXT_PUBLIC_SUPABASE_URL  - Supabase URL
  SUPABASE_SERVICE_ROLE     - Supabase Service Role Key
  OPENAI_API_KEY           - OpenAI API Key

注意:
  このスクリプトを実行する前に、Supabaseマイグレーションが適用されていることを確認してください。
`);

// プログラムを実行
program.parse(process.argv);