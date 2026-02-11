#!/usr/bin/env node
/**
 * pg_dump --data-only で出力した SQL から、指定スタッフに紐づく行だけを抽出し、
 * user_id をオーナーに付け替えた復元用 SQL を出力する。
 *
 * 対象テーブル: chat_sessions, chat_messages, content_annotations
 * 出力順: 依存関係を満たす順（chat_sessions → chat_messages → content_annotations）
 *
 * Usage:
 *   node scripts/restore-staff-chats-from-dump.js \
 *     --dump /path/to/YYYYMMDDTHHMMSSZ_data.sql \
 *     --staff-id <deleted-staff-uuid> \
 *     --owner-id <owner-uuid> \
 *   > restore.sql
 */
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS のスタンドアロンスクリプト */

const fs = require('fs');

const TABLES_IN_ORDER = [
  'public.chat_sessions',
  'public.chat_messages',
  'public.content_annotations',
];

function parseArgs() {
  const args = process.argv.slice(2);
  let dumpPath = null;
  let staffId = null;
  let ownerId = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dump' && args[i + 1]) {
      dumpPath = args[++i];
    } else if (args[i] === '--staff-id' && args[i + 1]) {
      staffId = args[++i];
    } else if (args[i] === '--owner-id' && args[i + 1]) {
      ownerId = args[++i];
    }
  }
  if (!dumpPath || !staffId || !ownerId) {
    console.error(
      'Usage: node restore-staff-chats-from-dump.js --dump <data.sql> --staff-id <uuid> --owner-id <uuid>'
    );
    process.exit(1);
  }
  if (!fs.existsSync(dumpPath)) {
    console.error('Error: Dump file not found:', dumpPath);
    process.exit(1);
  }
  return { dumpPath, staffId, ownerId };
}

/**
 * COPY ... FROM stdin; のブロックをパースする。
 * 戻り値: Map<tableName, { columns: string[], rows: string[][] }>
 */
function parseCopyBlocks(content) {
  const blocks = new Map();
  const copyRegex = /^COPY (public\.\w+) \((.*)\) FROM stdin;\s*$/gm;
  let m;
  while ((m = copyRegex.exec(content)) !== null) {
    const tableName = m[1];
    const columnsStr = m[2];
    const columns = columnsStr.split(/,\s*/).map((c) => c.trim());
    const start = m.index + m[0].length;
    const endMarker = '\n\\.\n';
    const endIdx = content.indexOf(endMarker, start);
    const data =
      endIdx === -1 ? content.slice(start) : content.slice(start, endIdx);
    const rows = data
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => line.split('\t'));
    blocks.set(tableName, { columns, rows });
  }
  return blocks;
}

function indexOfColumn(columns, name) {
  const i = columns.findIndex((c) => c.toLowerCase() === name.toLowerCase());
  if (i === -1) throw new Error(`Column "${name}" not found in [${columns.join(', ')}]`);
  return i;
}

function main() {
  const { dumpPath, staffId, ownerId } = parseArgs();
  const content = fs.readFileSync(dumpPath, 'utf-8');
  const blocks = parseCopyBlocks(content);

  const out = [];
  let restoredSessionIds = new Set();

  for (const tableName of TABLES_IN_ORDER) {
    const block = blocks.get(tableName);
    if (!block) {
      continue;
    }
    const { columns, rows } = block;
    const userIdx = indexOfColumn(columns, 'user_id');
    const sessionIdx = tableName === 'public.chat_messages' ? indexOfColumn(columns, 'session_id') : -1;

    let filteredRows;
    if (tableName === 'public.chat_sessions') {
      const idIdx = indexOfColumn(columns, 'id');
      filteredRows = rows.filter((row) => row[userIdx] === staffId);
      filteredRows.forEach((row) => restoredSessionIds.add(row[idIdx]));
      filteredRows.forEach((row) => {
        row[userIdx] = ownerId;
      });
    } else if (tableName === 'public.chat_messages') {
      filteredRows = rows.filter(
        (row) => restoredSessionIds.has(row[sessionIdx]) || row[userIdx] === staffId
      );
      filteredRows.forEach((row) => {
        row[userIdx] = ownerId;
      });
    } else {
      // content_annotations: UNIQUE (user_id, wp_post_id) と (user_id, canonical_url) があるため、
      // オーナー側に同一投稿/URLが既に存在すると一意制約違反になる。出力前に同一復元セット内の
      // 重複を除外し、適用時は PL/pgSQL で unique_violation をスキップする。
      filteredRows = rows.filter((row) => row[userIdx] === staffId);
      const wpPostIdx = indexOfColumn(columns, 'wp_post_id');
      const canonicalUrlIdx = indexOfColumn(columns, 'canonical_url');
      const seenWpPost = new Set();
      const seenCanonicalUrl = new Set();
      filteredRows = filteredRows.filter((row) => {
        row[userIdx] = ownerId;
        const wpVal = row[wpPostIdx];
        const wpKey =
          wpVal != null && wpVal !== '' && wpVal !== '\\N'
            ? `${ownerId}\t${wpVal}`
            : null;
        const urlVal = row[canonicalUrlIdx];
        const urlKey =
          urlVal != null && urlVal !== '' && urlVal !== '\\N'
            ? `${ownerId}\t${urlVal}`
            : null;
        if (wpKey != null && seenWpPost.has(wpKey)) return false;
        if (urlKey != null && seenCanonicalUrl.has(urlKey)) return false;
        if (wpKey != null) seenWpPost.add(wpKey);
        if (urlKey != null) seenCanonicalUrl.add(urlKey);
        return true;
      });
    }

    if (filteredRows.length === 0) {
      continue;
    }

    // user_id の値（UUID）は特殊文字を含まないため、
    // 既存のCOPY形式データはそのまま出力し、user_id のみ置換する
    if (tableName === 'public.content_annotations') {
      // 一意制約衝突を避けるため、一時表に COPY してから行単位 INSERT（unique_violation はスキップ）
      out.push('CREATE TEMP TABLE _restore_content_annotations (LIKE public.content_annotations INCLUDING DEFAULTS);');
      out.push(`COPY _restore_content_annotations (${columns.join(', ')}) FROM stdin;`);
      filteredRows.forEach((row) => {
        out.push(row.join('\t'));
      });
      out.push('\\.');
      out.push(`DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM _restore_content_annotations LOOP
    BEGIN
      INSERT INTO public.content_annotations SELECT * FROM _restore_content_annotations WHERE id = r.id;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;
END;
$$;`);
      out.push('DROP TABLE _restore_content_annotations;');
      out.push('');
    } else {
      out.push(`COPY ${tableName} (${columns.join(', ')}) FROM stdin;`);
      filteredRows.forEach((row) => {
        out.push(row.join('\t'));
      });
      out.push('\\.');
      out.push('');
    }
  }

  if (out.length === 0) {
    console.error('No rows matched staff_id. Check that the dump contains data for that user.');
    process.exit(1);
  }

  process.stdout.write(out.join('\n'));
}

main();
