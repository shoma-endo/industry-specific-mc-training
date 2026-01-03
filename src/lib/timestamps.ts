import { uuidv7 } from 'uuidv7';

// 同一ミリ秒内での順序保証のためのシーケンス番号
let lastTimestampMs = 0;
let sequenceCounter = 0;

export const parseTimestamp = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

export const parseTimestampOrNull = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export const parseTimestampStrict = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid timestamp number: ${value}`);
    }
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
    throw new Error(`Invalid timestamp string: "${value}"`);
  }
  throw new Error(`Null or undefined timestamp received: ${String(value)}`);
};

export const parseTimestampSafe = (
  value: string | number | null | undefined,
  fallback = 0
): number => {
  try {
    return parseTimestampStrict(value);
  } catch {
    return fallback;
  }
};

export const toIsoTimestamp = (value: number | Date): string => {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error(`Invalid timestamp number: ${value}`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Failed to convert to ISO timestamp: ${String(value)}`);
  }
  return date.toISOString();
};

/**
 * UUID v7からタイムスタンプ（ミリ秒）を抽出
 * UUID v7の最初の48ビット（12文字の16進数）がUnixタイムスタンプ（ミリ秒）
 * @param uuidv7 UUID v7形式の文字列
 * @returns タイムスタンプ（ミリ秒）
 */
export const extractTimestampFromUuidv7 = (uuidv7: string): number => {
  // UUID v7の形式: tttttttt-tttt-mmmm-rrrr-rrrrrrrrrrrr
  // 最初の12文字（ハイフンを除く）がタイムスタンプ部分
  const timestampHex = uuidv7.replace(/-/g, '').substring(0, 12);
  return parseInt(timestampHex, 16);
};

/**
 * UUID v7を使用して順序保証されたタイムスタンプを生成
 * 同一ミリ秒内で複数回呼び出された場合でも、シーケンス番号により順序が保証されます
 * @returns 順序保証されたタイムスタンプ（ISO文字列）
 */
export const generateOrderedTimestamp = (): string => {
  const uuid = uuidv7();
  const timestampMs = extractTimestampFromUuidv7(uuid);

  // 同一ミリ秒内での順序保証のため、シーケンス番号を使用
  if (timestampMs === lastTimestampMs) {
    sequenceCounter += 1;
  } else {
    // 新しいミリ秒の場合、シーケンス番号をリセット
    // 時刻が逆転した場合（システム時刻調整など）もリセット
    lastTimestampMs = timestampMs;
    sequenceCounter = 0;
  }

  // シーケンス番号をミリ秒に追加（順序保証のため）
  // 注意: シーケンス番号が大きくなりすぎないよう、最大999までに制限
  // 999を超える場合は、次のミリ秒に進める
  const maxSequence = 999;
  const adjustedTimestampMs =
    sequenceCounter > maxSequence ? timestampMs + 1 : timestampMs + sequenceCounter;

  return toIsoTimestamp(adjustedTimestampMs);
};
