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

/**
 * useAnnotationForm関連の型定義
 */
export type AnnotationFormState = Record<AnnotationFieldKey, string>;

export interface SubmissionHandlerResult {
  success?: boolean;
  error?: string;
  canonical_url?: string | null;
  [key: string]: unknown;
}

export interface SubmitPayload {
  fields: AnnotationFormState;
  canonicalUrl: string | null;
}

export interface SubmitOutcome {
  success: boolean;
  response?: SubmissionHandlerResult;
  normalizedCanonicalUrl: string | null;
}

export interface UseAnnotationFormOptions {
  initialFields?: AnnotationFields | AnnotationRecord | null;
  initialCanonicalUrl?: string | null;
  onSubmit: (payload: SubmitPayload) => Promise<SubmissionHandlerResult | void>;
}

export interface UseAnnotationFormResult {
  form: AnnotationFormState;
  updateField: (field: AnnotationFieldKey, value: string) => void;
  canonicalUrl: string;
  updateCanonicalUrl: (value: string) => void;
  canonicalUrlError: string;
  errorMessage: string;
  isSaving: boolean;
  saveDone: boolean;
  submit: () => Promise<SubmitOutcome>;
}
