export type RawItem = {
	link:    string
	title:   string
	snippet: string
}

export type SemrushAd = {
	domain: string;
	title: string;
	description: string;
}

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
        .trim()

    // 2) 切り詰めはせず、そのまま全文を返す
    return `${link}\n${title}\n${cleaned}`
    })
    .join('\n\n') // アイテム間に空行
}

/**
 * Semrush広告データの配列を受け取り、
 * 各広告を
 *   domain
 *   見出し：title
 *   説明文：description
 * の形式に変換し、
 * 各アイテム間を空行で区切った文字列を返す
 */
export function formatSemrushAds(ads: SemrushAd[]): string {
  return ads
    .map(({ domain, title, description }) => {
      const desc = description || '';
      return [
        'ドメイン：' + domain,
        '見出し：' + title,
        '説明文：' + desc,
      ].join('\n');
    })
    .join('\n\n'); // アイテム間に空行
}
