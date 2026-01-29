export const GA4_EVENT_SCROLL_90 = 'scroll_90';

export function normalizeToPath(input: string | null | undefined): string {
  if (!input) return '/';
  const trimmed = input.trim();
  if (!trimmed) return '/';

  const lowered = trimmed.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');

  if (lowered.startsWith('?') || lowered.startsWith('#')) {
    return '/';
  }

  let pathCandidate = lowered;
  if (!lowered.startsWith('/')) {
    const slashIndex = lowered.indexOf('/');
    if (slashIndex >= 0) {
      pathCandidate = lowered.slice(slashIndex);
    } else {
      return '/';
    }
  }

  const withoutFragment = pathCandidate.split('#')[0] ?? '';
  const withoutQuery = withoutFragment.split('?')[0] ?? '';

  if (!withoutQuery) return '/';

  const stripped = withoutQuery.replace(/\/+$/g, '');
  if (!stripped) return '/';
  return stripped === '/' ? '/' : stripped;
}

export function ga4DateStringToIso(dateString: string): string {
  if (!/^\d{8}$/.test(dateString)) {
    return dateString;
  }
  return `${dateString.slice(0, 4)}-${dateString.slice(4, 6)}-${dateString.slice(6, 8)}`;
}

export function formatJstDateISO(date: Date): string {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;

  if (!year || !month || !day) {
    return date.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

export function getJstDateISOFromTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return formatJstDateISO(new Date());
  }
  return formatJstDateISO(date);
}
