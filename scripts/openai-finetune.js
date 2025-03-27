#!/usr/bin/env node
const { OpenAI } = require('openai');
const fs = require('fs');
const { Command } = require('commander');
const dotenv = require('dotenv');
const { stringify } = require('csv-stringify/sync');
const { parse } = require('csv-parse/sync');

// 環境変数の読み込み
dotenv.config({ path: '.env.local' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const program = new Command();

// プログラムの説明と版数を設定
program
  .name('openai-finetune')
  .description('OpenAI APIのファインチューニングを行うスクリプト')
  .version('1.0.0');

// 訓練データをJSONL形式に変換するコマンド
program
  .command('prepare')
  .description('CSVファイルからJSONL形式の訓練データを作成します')
  .requiredOption('-i, --input <path>', 'CSV入力ファイルのパス')
  .requiredOption('-o, --output <path>', '出力するJSONLファイルのパス')
  .option('-f, --format <format>', 'データフォーマット (chat/completion/user-system)', 'chat')
  .action(async options => {
    try {
      console.log('訓練データの準備を開始します...');

      // CSVファイルの読み込み
      const fileContent = fs.readFileSync(options.input, 'utf8');
      const records = parse(fileContent, { columns: true, skip_empty_lines: true });

      const jsonlData = [];

      if (options.format === 'chat') {
        // チャット形式のデータ準備
        for (const record of records) {
          if (!record.system_prompt || !record.user_message || !record.assistant_message) {
            console.warn(
              '警告: 行にシステムプロンプト、ユーザーメッセージ、アシスタントメッセージのいずれかが欠けています'
            );
            continue;
          }

          const chatExample = {
            messages: [
              { role: 'system', content: record.system_prompt },
              { role: 'user', content: record.user_message },
              { role: 'assistant', content: record.assistant_message },
            ],
          };

          jsonlData.push(JSON.stringify(chatExample));
        }
      } else if (options.format === 'completion') {
        // 補完形式のデータ準備
        for (const record of records) {
          if (!record.prompt || !record.completion) {
            console.warn('警告: 行にプロンプトまたは補完が欠けています');
            continue;
          }

          const completionExample = {
            prompt: record.prompt,
            completion: record.completion,
          };

          jsonlData.push(JSON.stringify(completionExample));
        }
      } else if (options.format === 'user-system') {
        // user,systemフォーマットのデータ準備
        for (const record of records) {
          // systemもしくはsysytem列のどちらかをチェック
          const systemContent = record.system || record.sysytem;

          if (!record.user || !systemContent) {
            console.warn('警告: 行にuserまたはsystem/sysytemが欠けています');
            continue;
          }

          // アシスタントのメッセージを含むように修正（OpenAIの要件を満たすため）
          const chatExample = {
            messages: [
              { role: 'system', content: systemContent },
              { role: 'user', content: record.user },
              // ファインチューニングでは最後のメッセージがassistantでなければならない
              {
                role: 'assistant',
                content:
                  'これはファインチューニングのためのサンプル応答です。実際のトレーニングではここに適切な応答が含まれるべきです。',
              },
            ],
          };

          jsonlData.push(JSON.stringify(chatExample));
        }
      }

      // JSONLファイルの書き込み
      fs.writeFileSync(options.output, jsonlData.join('\n'));

      console.log(
        `訓練データの準備が完了しました。${jsonlData.length}件のサンプルをJSONL形式で保存しました。`
      );
    } catch (error) {
      console.error('エラー:', error);
      process.exit(1);
    }
  });

// ファイルをアップロードするコマンド
program
  .command('upload')
  .description('ファインチューニング用のファイルをアップロードします')
  .requiredOption('-f, --file <path>', 'アップロードするJSONLファイルのパス')
  .action(async options => {
    try {
      console.log('ファイルをアップロードしています...');

      const file = await openai.files.create({
        file: fs.createReadStream(options.file),
        purpose: 'fine-tune',
      });

      console.log(`ファイルのアップロードが完了しました。ファイルID: ${file.id}`);
      console.log(
        'ファイルのステータスがready状態になるまで数分待ってからファインチューニングを開始してください。'
      );
    } catch (error) {
      console.error('エラー:', error);
      process.exit(1);
    }
  });

// ファインチューニングを作成するコマンド
program
  .command('create')
  .description('ファインチューニングジョブを作成します')
  .requiredOption('-f, --file <file_id>', 'ファインチューニングに使用するファイルID')
  .option('-m, --model <model>', 'ベースモデル名', 'gpt-4o-2024-08-06')
  .option('-n, --name <name>', 'ファインチューニングジョブの名前')
  .option('-e, --epochs <number>', 'エポック数', '3')
  .action(async options => {
    try {
      console.log('ファインチューニングジョブを作成しています...');

      const fineTuningJob = await openai.fineTuning.jobs.create({
        training_file: options.file,
        model: options.model,
        suffix: options.name,
        hyperparameters: {
          n_epochs: parseInt(options.epochs),
        },
      });

      console.log(`ファインチューニングジョブが作成されました。ジョブID: ${fineTuningJob.id}`);
      console.log('ファインチューニングの完了には数時間から数日かかる場合があります。');
    } catch (error) {
      console.error('エラー:', error);
      process.exit(1);
    }
  });

// ファインチューニングジョブのリストを取得するコマンド
program
  .command('list')
  .description('ファインチューニングジョブのリストを表示します')
  .action(async () => {
    try {
      console.log('ファインチューニングジョブのリストを取得しています...');

      const fineTuningJobs = await openai.fineTuning.jobs.list();

      if (fineTuningJobs.data.length === 0) {
        console.log('ファインチューニングジョブはありません。');
        return;
      }

      console.log('ファインチューニングジョブのリスト:');
      for (const job of fineTuningJobs.data) {
        console.log(`- ID: ${job.id}`);
        console.log(`  モデル: ${job.model}`);
        console.log(`  ステータス: ${job.status}`);
        console.log(`  作成日時: ${new Date(job.created_at * 1000).toLocaleString()}`);
        console.log('---');
      }
    } catch (error) {
      console.error('エラー:', error);
      process.exit(1);
    }
  });

// ファインチューニングジョブの詳細を取得するコマンド
program
  .command('get')
  .description('特定のファインチューニングジョブの詳細を表示します')
  .requiredOption('-j, --job <job_id>', 'ファインチューニングジョブID')
  .action(async options => {
    try {
      console.log(`ジョブID ${options.job} の詳細を取得しています...`);

      const job = await openai.fineTuning.jobs.retrieve(options.job);

      console.log('ジョブの詳細:');
      console.log(`- ID: ${job.id}`);
      console.log(`- モデル: ${job.model}`);
      console.log(`- ベースモデル: ${job.model.split(':')[0]}`);
      console.log(`- ステータス: ${job.status}`);
      console.log(`- 訓練ファイル: ${job.training_file}`);
      console.log(`- 検証ファイル: ${job.validation_file || 'なし'}`);
      console.log(`- 作成日時: ${new Date(job.created_at * 1000).toLocaleString()}`);
      console.log(
        `- 完了日時: ${job.finished_at ? new Date(job.finished_at * 1000).toLocaleString() : '未完了'}`
      );

      if (job.fine_tuned_model) {
        console.log(`- ファインチューニング済みモデル: ${job.fine_tuned_model}`);
      }
    } catch (error) {
      console.error('エラー:', error);
      process.exit(1);
    }
  });

// キャンセルコマンド
program
  .command('cancel')
  .description('ファインチューニングジョブをキャンセルします')
  .requiredOption('-j, --job <job_id>', 'キャンセルするファインチューニングジョブID')
  .action(async options => {
    try {
      console.log(`ジョブID ${options.job} をキャンセルしています...`);

      const job = await openai.fineTuning.jobs.cancel(options.job);

      console.log(`ジョブのキャンセルリクエストが送信されました。ステータス: ${job.status}`);
    } catch (error) {
      console.error('エラー:', error);
      process.exit(1);
    }
  });

// プログラムを実行
program.parse(process.argv);
