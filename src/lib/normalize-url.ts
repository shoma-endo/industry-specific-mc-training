/**
 * URLを正規化して比較やDB保存用のキーとして使用可能にする
 *
 * ロジック:
 * 1. 小文字化
 * 2. プロトコル (http://, https://) の削除
 * 3. www. の削除
 * 4. 末尾の / の削除
 *
 * 注意: PostgreSQL の public.normalize_url(text) 関数と同一の挙動にする必要があります
 */
export function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const lowered = url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
    return lowered.replace(/\/+$/g, '');
  } catch {
    return null;
  }
}

