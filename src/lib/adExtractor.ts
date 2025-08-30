export type RawItem = {
  link: string;
  title: string;
  snippet: string;
};

/**
 * items 配列から link, title, snippet を抽出し、
 * 1) snippet の先頭行にある英語日付パターン (e.g. "Jan 9, 2025") を除去
 * 2) 切り詰め処理はナシ
 * 3) link + "\n" + title + "\n" + cleanedSnippet をアイテムごとにまとめ、
 *    各アイテム間を空行で区切った文字列を返す
 */
export function formatAdItems(items: RawItem[]): string {
  return items
    .map(({ link, title, snippet }) => {
      // 1) 日付行を取り除く
      const cleaned = snippet
        .split('\n')
        .filter(line => !/^[A-Za-z]{3}\s+\d{1,2},\s*\d{4}/.test(line.trim()))
        .join(' ')
        .trim();

      // 2) 切り詰めはせず、そのまま全文を返す
      return `${link}\n${title}\n${cleaned}`;
    })
    .join('\n\n'); // アイテム間に空行
}

/**
 * items 配列から title を抽出し、改行区切りで結合した文字列を返す
 */
export function formatAdTitles(items: RawItem[]): string {
  return items.map(({ title }) => title).join('\n');
}
