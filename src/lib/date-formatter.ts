/**
 * 日付フォーマット関連のユーティリティ関数
 */

/**
 * 相対日付フォーマット（今日/昨日/日付）
 * SessionListContent で使用
 */
export function formatRelativeDate(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return '今日';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return '昨日';
  } else {
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  }
}

/**
 * ISO日付文字列をフォーマット済み日付文字列に変換
 * GscSetupClient で使用
 *
 * @param value - ISO形式の日付文字列
 * @returns フォーマット済みの日付文字列（日本語、中程度の日付スタイル + 短い時刻スタイル）、または null
 */
export function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
