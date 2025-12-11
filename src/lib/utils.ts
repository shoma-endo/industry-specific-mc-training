import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ');
}

/**
 * ISO8601形式の日時文字列を「2025年12月11日 12:34」形式にフォーマット
 * @param isoString - ISO8601形式の日時文字列
 * @returns 日本語フォーマットの日時文字列
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  });
  return formatter.format(date);
}
