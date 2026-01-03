import { uuidv7 } from 'uuidv7';

// 同一秒内での順序保証のためのシーケンス番号
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
 * @throws {Error} 無効なUUID v7形式が渡された場合
 */
export const extractTimestampFromUuidv7 = (uuidv7: string): number => {
  // UUID v7形式の基本的な検証
  if (!uuidv7 || typeof uuidv7 !== 'string' || uuidv7.length < 36) {
    throw new Error(`Invalid UUID v7 format: ${uuidv7}`);
  }
  // UUID v7の形式: tttttttt-tttt-mmmm-rrrr-rrrrrrrrrrrr
  // 最初の12文字（ハイフンを除く）がタイムスタンプ部分
  const timestampHex = uuidv7.replace(/-/g, '').substring(0, 12);
  const timestamp = parseInt(timestampHex, 16);
  if (Number.isNaN(timestamp)) {
    throw new Error(`Failed to parse timestamp from UUID v7: ${uuidv7}`);
  }
  return timestamp;
};

/**
 * UUID v7を使用して順序保証されたタイムスタンプを生成
 * 同一秒内で複数回呼び出された場合でも、シーケンス番号により順序が保証されます
 * シーケンス番号は小数部分（ミリ秒の小数）として扱われ、秒レベルのタイムスタンプを保持します
 * @returns 順序保証されたタイムスタンプ（ISO文字列）
 * @throws {Error} 同一秒内で1000回以上の呼び出しが発生した場合
 */
export const generateOrderedTimestamp = (): string => {
  const uuid = uuidv7();
  const timestampMs = extractTimestampFromUuidv7(uuid);

  // 同一秒内での順序保証のため、シーケンス番号を使用
  const timestampSeconds = Math.floor(timestampMs / 1000);
  const lastTimestampSeconds = Math.floor(lastTimestampMs / 1000);

  if (timestampSeconds === lastTimestampSeconds) {
    sequenceCounter += 1;
  } else {
    // 新しい秒の場合、シーケンス番号をリセット
    // 時刻が逆転した場合（システム時刻調整など）もリセット
    lastTimestampMs = timestampMs;
    sequenceCounter = 0;
  }

  // シーケンスカウンターのオーバーフローチェック
  // 同一秒内で1000回以上の呼び出しは異常な状態とみなし、エラーをスロー
  const maxSequence = 999;
  if (sequenceCounter > maxSequence) {
    throw new Error(
      `Sequence counter overflow: ${sequenceCounter} calls within the same second (timestamp: ${timestampMs})`
    );
  }

  // シーケンス番号を小数部分として扱う（0.001秒 = 1ミリ秒の小数部分）
  // シーケンス番号を0.001秒（1ミリ秒）単位で追加し、ISO文字列の小数部分に反映
  const sequenceFraction = sequenceCounter * 0.001;

  // 秒レベルのタイムスタンプを生成（小数部分はシーケンスで制御）
  const timestampSecondsMs = timestampSeconds * 1000;
  const baseIsoString = toIsoTimestamp(timestampSecondsMs);

  // 小数部分を計算（0.000から0.999の範囲）
  // sequenceCounter=0の場合は0.000、1の場合は0.001、...、999の場合は0.999
  const fractionalString = sequenceFraction.toFixed(3).substring(1); // ".000"から".999"

  // ISO文字列の小数部分を置き換え（シーケンスで順序を保証）
  return baseIsoString.replace(/\.\d{3}/, fractionalString);
};
