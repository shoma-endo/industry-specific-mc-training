/**
 * 日付・時刻ユーティリティ関数
 */

/**
 * ISO8601形式の日時文字列を「2025年12月11日 12:34」形式にフォーマット
 * @param isoString - ISO8601形式の日時文字列
 * @returns 日本語フォーマットの日時文字列
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return '日付不明';
  }
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

/**
 * JST（日本標準時）の現在日時を取得する
 * @returns Date オブジェクト
 */
export function getNowJst(): Date {
  return new Date();
}

/**
 * Date オブジェクトを YYYY-MM-DD 形式の ISO 日付文字列に変換する
 * @param date - Date オブジェクト
 * @returns YYYY-MM-DD 形式の日付文字列
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * ISO日付文字列に指定日数を加算する
 * @param isoDate - YYYY-MM-DD 形式の日付文字列
 * @param days - 加算する日数
 * @returns YYYY-MM-DD 形式の日付文字列
 */
export function addDaysISO(isoDate: string, days: number): string {
  const date = new Date(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateISO(date);
}

/**
 * OAuth の expires_in（秒）を ISO 形式の日時文字列に変換する
 * @param expiresIn - 有効期限（秒）
 * @returns ISO 8601 形式の日時文字列
 */
export function expiresInToISOString(expiresIn: number): string {
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

/**
 * GSCの取得レンジを算出（GSCは2日前まで）
 * @param days - 取得する日数
 * @returns { startIso, endIso } - YYYY-MM-DD 形式の開始日と終了日
 */
export function buildGscDateRange(days: number): { startIso: string; endIso: string } {
  const endDate = new Date();
  endDate.setUTCDate(endDate.getUTCDate() - 2);
  const endIso = formatDateISO(endDate);
  const startIso = addDaysISO(endIso, -(days - 1));

  return {
    startIso,
    endIso,
  };
}

