const WHITESPACE_REGEX = /\s+/g;

export function normalizeQuery(input: string | null | undefined): string {
  if (!input) return '';

  const trimmed = input.trim();
  if (!trimmed) return '';

  const normalized = trimmed
    .normalize('NFKC')
    .toLowerCase()
    .replace(WHITESPACE_REGEX, ' ')
    .trim();

  return normalized;
}

