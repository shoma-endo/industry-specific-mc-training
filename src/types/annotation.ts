export const ANNOTATION_FIELD_KEYS = [
  'main_kw',
  'kw',
  'impressions',
  'needs',
  'persona',
  'goal',
  'prep',
  'basic_structure',
  'opening_proposal',
] as const;

type AnnotationFieldTuple = typeof ANNOTATION_FIELD_KEYS;
export type AnnotationFieldKey = AnnotationFieldTuple[number];

export type AnnotationFieldValue = string | null;

export type AnnotationFields = Partial<Record<AnnotationFieldKey, AnnotationFieldValue>>;

export interface AnnotationRecord extends AnnotationFields {
  canonical_url?: string | null;
  wp_post_id?: number | null;
  session_id?: string | null;
  memo?: string | null;
}

export interface ContentAnnotationPayload extends AnnotationFields {
  wp_post_id: number;
  canonical_url?: string | null;
}

export interface SessionAnnotationUpsertPayload extends AnnotationFields {
  session_id: string;
  canonical_url?: string | null;
}
