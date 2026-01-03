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

export const parseTimestampOrNull = (
  value: string | number | null | undefined
): number | null => {
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

export const toIsoTimestamp = (value: number | Date): string => new Date(value).toISOString();
