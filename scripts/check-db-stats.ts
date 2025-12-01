import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// PostgreSQL接続用の型定義（pgライブラリがインストールされていない場合のフォールバック）
interface TableSizeInfo {
  table_name: string;
  size_pretty: string;
  size_bytes: number;
}

interface DatabaseSizeInfo {
  database_size_pretty: string;
  database_size_bytes: number;
}

// .env.localファイルから環境変数を読み込む
function loadEnv() {
  try {
    const envPath = join(__dirname, '../.env.local');
    const envContent = readFileSync(envPath, 'utf-8');
    const env: Record<string, string> = {};

    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts
            .join('=')
            .trim()
            .replace(/^["']|["']$/g, '');
        }
      }
    }

    return env;
  } catch (error) {
    console.error('環境変数の読み込みエラー:', error);
    return {};
  }
}

/**
 * データベースから実際に存在するテーブル一覧を取得する
 * get_table_sizes RPC関数を使用して、実際のデータベースから直接取得
 */
async function getAllTables(client: ReturnType<typeof createClient>): Promise<string[]> {
  try {
    // get_table_sizes(NULL) を呼び出すと、publicスキーマ内の全テーブルを取得できる
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client as any).rpc('get_table_sizes', {
      table_names: null,
    });

    if (error) {
      console.error('⚠️  テーブル一覧の取得に失敗しました:', error.message);
      return [];
    }

    if (!data || !Array.isArray(data)) {
      console.warn('⚠️  テーブルデータが取得できませんでした。');
      return [];
    }

    // テーブル名のみを抽出してソート
    const tableNames = data.map((row: TableSizeInfo) => row.table_name).sort();
    return tableNames;
  } catch (error) {
    console.error('テーブル一覧の取得エラー:', error);
    return [];
  }
}

/**
 * SupabaseのRPC関数を使って容量情報を取得
 */
async function getDatabaseSizes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any
): Promise<{
  databaseSize: DatabaseSizeInfo | null;
  tableSizes: TableSizeInfo[];
}> {
  try {
    // データベース全体のサイズを取得
    const { data: dbSizeData, error: dbSizeError } = await client.rpc('get_database_size');

    if (dbSizeError) {
      console.warn('⚠️  データベースサイズの取得に失敗しました:', dbSizeError.message);
    }

    // テーブルごとのサイズを取得（全テーブル）
    const { data: tableSizeData, error: tableSizeError } = await client.rpc('get_table_sizes', {
      table_names: null, // NULLを渡して全テーブルを取得
    });

    if (tableSizeError) {
      console.warn('⚠️  テーブルサイズの取得に失敗しました:', tableSizeError.message);
    }

    // データの型を確認して適切に処理
    const databaseSize =
      dbSizeData && Array.isArray(dbSizeData) && dbSizeData.length > 0
        ? (dbSizeData[0] as DatabaseSizeInfo)
        : null;
    const tableSizes = (Array.isArray(tableSizeData) ? tableSizeData : []) as TableSizeInfo[];

    return {
      databaseSize,
      tableSizes,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Supabaseデータベースの統計情報を取得するスクリプト
 */
async function checkDatabaseStats() {
  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRole = env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !supabaseServiceRole) {
    throw new Error('環境変数が設定されていません。.env.localファイルを確認してください。');
  }

  const client = createClient(supabaseUrl, supabaseServiceRole);

  console.log('=== Supabase データベース統計情報 ===\n');

  try {
    // データベースから動的にテーブル一覧を取得
    console.log('🔍 テーブル一覧を取得中...');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tables = await getAllTables(client as any);

    if (tables.length === 0) {
      console.log('⚠️  テーブルが見つかりませんでした。');
      return;
    }

    console.log(`📋 検出されたテーブル数: ${tables.length}\n`);
    console.log('📈 各テーブルのレコード数:');
    const tableCounts: Record<string, number> = {};
    let totalRecords = 0;

    for (const table of tables) {
      try {
        const { count, error } = await client
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) {
          console.log(`  ${table}: エラー (${error.message})`);
          tableCounts[table] = 0;
        } else {
          const recordCount = count || 0;
          tableCounts[table] = recordCount;
          totalRecords += recordCount;
          console.log(`  ${table}: ${recordCount.toLocaleString()} レコード`);
        }
      } catch {
        console.log(`  ${table}: エラー (テーブルが存在しない可能性があります)`);
        tableCounts[table] = 0;
      }
    }

    console.log(`\n📊 合計レコード数: ${totalRecords.toLocaleString()}`);

    // 容量情報を取得（RPC関数を使用）
    console.log('\n💾 データベース容量情報:');
    try {
      const { databaseSize, tableSizes } = await getDatabaseSizes(client);

      if (databaseSize) {
        console.log(`  📦 データベース全体のサイズ: ${databaseSize.database_size_pretty}`);
        console.log(`     (${(databaseSize.database_size_bytes / 1024 / 1024).toFixed(2)} MB)`);
      } else {
        console.log('  ⚠️  データベースサイズ情報が取得できませんでした。');
      }

      if (tableSizes.length > 0) {
        console.log('\n  📋 テーブルごとのサイズ:');
        for (const tableSize of tableSizes) {
          const recordCount = tableCounts[tableSize.table_name] || 0;
          const avgSizePerRecord =
            recordCount > 0 ? (tableSize.size_bytes / recordCount / 1024).toFixed(2) : 'N/A';
          console.log(
            `    ${tableSize.table_name}: ${tableSize.size_pretty} (${recordCount.toLocaleString()} レコード, 平均 ${avgSizePerRecord} KB/レコード)`
          );
        }

        const totalSizeBytes = tableSizes.reduce((sum, t) => sum + t.size_bytes, 0);
        console.log(`\n  📊 テーブル合計サイズ: ${(totalSizeBytes / 1024 / 1024).toFixed(2)} MB`);
      } else {
        console.log('  ⚠️  テーブルサイズ情報が取得できませんでした。');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`  ⚠️  容量情報の取得に失敗しました: ${errorMessage}`);
      console.log(
        '  💡 ヒント: RPC関数（get_database_size, get_table_sizes）が作成されているか確認してください。'
      );
    }

    // 無料プランの制限との比較
    console.log('\n💰 Supabase無料プランの制限:');
    console.log('  - データベースサイズ: 500 MB');
    console.log('  - 月間アクティブユーザー: 50,000人');
    console.log('  - ストレージ: 1 GB');
    console.log('  - エグレス: 5 GB/月');

    // 推奨事項
    console.log('\n💡 推奨事項:');
    if (totalRecords > 100000) {
      console.log('  ⚠️  レコード数が10万を超えています。プロプランへの移行を検討してください。');
    } else if (totalRecords > 50000) {
      console.log(
        '  ⚠️  レコード数が5万を超えています。近い将来プロプランへの移行を検討してください。'
      );
    } else {
      console.log('  ✅ 現時点では無料プランで十分です。');
    }
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

// スクリプト実行
checkDatabaseStats()
  .then(() => {
    console.log('\n✅ 統計情報の取得が完了しました');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ エラー:', error);
    process.exit(1);
  });
