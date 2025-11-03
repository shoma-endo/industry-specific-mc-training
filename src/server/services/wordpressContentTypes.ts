export const DEFAULT_WORDPRESS_CONTENT_TYPES = ['posts', 'pages'] as const;

export type WordPressContentType = string;

export function normalizeContentType(input: string): WordPressContentType {
  const trimmed = input.replace(/^\/+/, '').replace(/\/+$/, '').trim();
  if (!trimmed) {
    return 'posts';
  }
  const lowered = trimmed.toLowerCase();
  if (lowered === 'post') return 'posts';
  if (lowered === 'page') return 'pages';
  return trimmed;
}

export function normalizeContentTypes(inputs?: string[] | null): WordPressContentType[] {
  const base = Array.isArray(inputs) ? inputs : [];
  const normalized = base
    .map(value => normalizeContentType(value))
    .filter(Boolean);

  if (normalized.length === 0) {
    return Array.from(DEFAULT_WORDPRESS_CONTENT_TYPES);
  }

  return Array.from(new Set(normalized));
}
