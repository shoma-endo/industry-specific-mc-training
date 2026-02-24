/**
 * Extract H3 and H4 headings from markdown text.
 */
export interface ExtractedHeading {
  text: string;
  level: 3 | 4;
  orderIndex: number;
}

/**
 * Step 5の構成案テキストから、H3およびH4の見出しを抽出する。
 * コードブロック内や、その他のレベルの見出しは無視する。
 */
export function extractHeadingsFromMarkdown(markdown: string): ExtractedHeading[] {
  if (!markdown) return [];

  const lines = markdown.split('\n');
  const headings: ExtractedHeading[] = [];
  let inCodeBlock = false;
  let orderIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // コードブロックの開始/終了を検知
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) continue;

    // H3 (###) または H4 (####) の見出しにマッチ
    // 正規表現: 行頭から # が 3〜4 つ続き、その後に空白、そして見出しテキスト
    const match = trimmed.match(/^(#{3,4})\s+(.+)$/);
    if (match) {
      const hashes = match[1] || '';
      const text = (match[2] || '').trim();

      // 空の見出しは除外
      if (text) {
        const level = hashes.length as 3 | 4;
        headings.push({
          text,
          level,
          orderIndex: orderIndex++,
        });
      }
    }
  }

  return headings;
}

/**
 * 見出しの識別子（heading_key）を生成する。
 * 形式: {order_index}:{normalized_heading_text}:{short_hash}
 *
 * 設計上の注意: 見出しテキストが変わるとキーが変わり、既存DBレコードとの紐付けが切れる。
 * (session_id, heading_key) の UNIQUE 制約により、step5 を微修正した場合は新規セクション扱いになる。
 * 将来的にテキスト微修正（誤字等）への耐性が必要な場合は、orderIndex のみをキーにする方式の検討を推奨。
 */
export function generateHeadingKey(orderIndex: number, headingText: string): string {
  const normalizedText = headingText
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const hash = simpleHash(headingText);
  return `${orderIndex}:${normalizedText}:${hash}`;
}

/** 句読点・記号（文末でよく付くもの） */
const TRAILING_PUNCTUATION = /[。、．，．・!?！？\s]*$/;

/**
 * 見出し比較用の正規化（余分な空白・全角半角揺れ・句読点に耐性を持たせる）
 */
function normalizeHeadingForComparison(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .replace(TRAILING_PUNCTUATION, '')
    .normalize('NFKC');
}

/**
 * 正規化後の見出し同士が「実質一致」とみなせるか。
 * 完全一致、LLM の句読点追加（line が expected + 句読点で始まる）のみ許容する。
 * expected が line の prefix となる短い前方一致は許容しない（例: 「導入」と「導入手順」の誤除去を防ぐ）。
 */
function headingsMatchAfterNormalization(lineNorm: string, expectedNorm: string): boolean {
  if (lineNorm === expectedNorm) return true;
  if (lineNorm.startsWith(expectedNorm)) {
    const suffix = lineNorm.slice(expectedNorm.length).trim();
    return suffix.length === 0 || /^[。、．，．・!?！？：:-]+$/.test(suffix);
  }
  return false;
}

/**
 * Step6保存時用: 先頭の見出し行を除去する。
 * combineSections が heading_text を自動付与するため、content には本文のみを保存する。
 * 先頭行が markdown 見出し (# で始まる) かつ headingText と実質一致する場合に除去。
 * LLM の句読点追加・語尾変更・軽微な言い換えにも耐性を持つ。
 */
export function stripLeadingHeadingLine(content: string, headingText: string): string {
  const trimmed = content.trim();
  if (!trimmed || !headingText) return content;

  const firstLine = trimmed.split('\n')[0]?.trim() ?? '';
  const match = firstLine.match(/^#+\s+(.+)$/);
  if (!match) return content;

  const lineHeadingText = (match[1] ?? '').trim();
  const a = normalizeHeadingForComparison(lineHeadingText);
  const b = normalizeHeadingForComparison(headingText);
  if (!headingsMatchAfterNormalization(a, b)) return content;

  // 見出し直後の改行のみ除去。本文先頭のインデント（コードブロック・ネスト箇条書き等）は保持する
  const rest = trimmed.slice(firstLine.length).replace(/^[\r\n]+/, '');
  return rest;
}

/**
 * 文字列から短いハッシュ（4文字のBase36）を生成する。
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    // int32に切り詰めてオーバーフローを防ぐ
    hash = (hash << 5) - hash + char;
    hash = hash | 0;
  }
  // Base36に変換し、衝突回避のために絶対値を使用
  return Math.abs(hash).toString(36).slice(0, 4).padStart(4, '0');
}
