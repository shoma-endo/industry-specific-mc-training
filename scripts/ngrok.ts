#!/usr/bin/env tsx
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

// .env.local を読み込む
const envFile = '.env.local';
const envVars: Record<string, string> = {};

try {
  const content = readFileSync(envFile, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    // コメント行と空行をスキップ
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // KEY=value 形式をパース（行末のコメントも考慮）
    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && match[1] && match[2] !== undefined) {
      const key = match[1];
      let value = match[2];

      // 行末のコメントを除去（クォート外の#を検出）
      // クォート内の#は無視し、クォート外の最初の#をコメントとして扱う
      let inQuotes = false;
      let quoteChar = '';
      let commentIndex = -1;

      for (let i = 0; i < value.length; i++) {
        const char = value[i];
        const prevChar = i > 0 ? value[i - 1] : '';

        // エスケープされた文字はスキップ
        if (prevChar === '\\') {
          continue;
        }

        // クォートの開始/終了を検出
        if ((char === '"' || char === "'") && !inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar && inQuotes) {
          inQuotes = false;
          quoteChar = '';
        } else if (char === '#' && !inQuotes) {
          // クォート外の#をコメントとして検出
          commentIndex = i;
          break;
        }
      }

      if (commentIndex !== -1) {
        value = value.substring(0, commentIndex).trim();
      }

      // クォートを除去
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      envVars[key] = value;
    }
  }
} catch {
  console.error(`エラー: ${envFile} を読み込めませんでした。`);
  process.exit(1);
}

// NEXT_PUBLIC_SITE_URL をチェック
if (!envVars.NEXT_PUBLIC_SITE_URL) {
  console.error(
    'エラー: NEXT_PUBLIC_SITE_URL が設定されていません。.env.local を確認してください。'
  );
  process.exit(1);
}

// ドメインを抽出（https:// を除去）
const domain = envVars.NEXT_PUBLIC_SITE_URL.replace(/^https?:\/\//, '');

// ドメインに危険な文字が含まれていないか検証
if (!/^[a-zA-Z0-9.-]+$/.test(domain)) {
  console.error('エラー: ドメインに不正な文字が含まれています。');
  process.exit(1);
}

// ngrok を実行
try {
  execSync(`ngrok http --domain=${domain} 3000`, {
    stdio: 'inherit',
    env: { ...process.env, ...envVars },
  });
} catch {
  process.exit(1);
}
