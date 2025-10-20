import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ANNOTATION_FIELD_KEYS,
  type AnnotationFieldKey,
  type AnnotationFields,
  type AnnotationRecord,
} from '@/types/annotation';

type AnnotationFormState = Record<AnnotationFieldKey, string>;

const EMPTY_FORM_ENTRIES = ANNOTATION_FIELD_KEYS.map(key => [key, ''] as const);
const EMPTY_FORM = Object.fromEntries(EMPTY_FORM_ENTRIES) as AnnotationFormState;

const toFormState = (
  fields?: AnnotationFields | AnnotationRecord | null
): AnnotationFormState => {
  return ANNOTATION_FIELD_KEYS.reduce(
    (acc, key) => {
      acc[key] = fields?.[key] ?? '';
      return acc;
    },
    { ...EMPTY_FORM }
  );
};

type SubmissionHandlerResult = {
  success?: boolean;
  error?: string;
  canonical_url?: string | null;
  [key: string]: unknown;
};

type SubmitPayload = {
  fields: AnnotationFormState;
  canonicalUrl: string | null;
};

type SubmitOutcome = {
  success: boolean;
  response?: SubmissionHandlerResult;
  normalizedCanonicalUrl: string | null;
};

type Options = {
  initialFields?: AnnotationFields | AnnotationRecord | null;
  initialCanonicalUrl?: string | null;
  onSubmit: (payload: SubmitPayload) => Promise<SubmissionHandlerResult | void>;
};

type UseAnnotationFormResult = {
  form: AnnotationFormState;
  updateField: (field: AnnotationFieldKey, value: string) => void;
  canonicalUrl: string;
  updateCanonicalUrl: (value: string) => void;
  canonicalUrlError: string;
  errorMessage: string;
  isSaving: boolean;
  saveDone: boolean;
  submit: () => Promise<SubmitOutcome>;
};

export function useAnnotationForm({
  initialFields,
  initialCanonicalUrl,
  onSubmit,
}: Options): UseAnnotationFormResult {
  const [form, setForm] = useState<AnnotationFormState>(() => toFormState(initialFields));
  const [canonicalUrl, setCanonicalUrl] = useState<string>(() => initialCanonicalUrl ?? '');
  const [canonicalUrlError, setCanonicalUrlError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveDone, setSaveDone] = useState(false);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setForm(toFormState(initialFields));
  }, [initialFields]);

  useEffect(() => {
    setCanonicalUrl(initialCanonicalUrl ?? '');
    setCanonicalUrlError('');
  }, [initialCanonicalUrl]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const updateField = useCallback((field: AnnotationFieldKey, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const updateCanonicalUrl = useCallback((value: string) => {
    setCanonicalUrl(value);
    if (canonicalUrlError) {
      setCanonicalUrlError('');
    }
  }, [canonicalUrlError]);

  const submit = useCallback(async (): Promise<SubmitOutcome> => {
    const trimmed = canonicalUrl.trim();
    let normalizedUrl: string | null = null;

    if (trimmed.length > 0) {
      try {
        const parsed = new URL(trimmed);
        normalizedUrl = parsed.toString();
      } catch {
        setCanonicalUrlError('有効なURLを入力してください');
        return { success: false, normalizedCanonicalUrl: null };
      }
    }

    setErrorMessage('');
    setIsSaving(true);
    setSaveDone(false);

    try {
      const response = (await onSubmit({ fields: form, canonicalUrl: normalizedUrl })) ?? undefined;
      const success = Boolean(response?.success);

      if (success) {
        setSaveDone(true);
        if (resetTimerRef.current) {
          clearTimeout(resetTimerRef.current);
        }
        resetTimerRef.current = setTimeout(() => {
          setSaveDone(false);
          resetTimerRef.current = null;
        }, 900);

        const nextCanonical =
          response?.canonical_url !== undefined
            ? response.canonical_url ?? ''
            : normalizedUrl ?? '';
        setCanonicalUrl(nextCanonical);
        setCanonicalUrlError('');

        const outcome: SubmitOutcome = {
          success: true,
          normalizedCanonicalUrl: normalizedUrl,
        };
        if (response) {
          outcome.response = response;
        }

        return outcome;
      }

      const message = response?.error || '保存に失敗しました';
      setErrorMessage(message);
      if (normalizedUrl) {
        setCanonicalUrlError(response?.error ?? '');
      }

      const outcome: SubmitOutcome = {
        success: false,
        normalizedCanonicalUrl: normalizedUrl,
      };
      if (response) {
        outcome.response = response;
      }

      return outcome;
    } catch {
      setErrorMessage('保存に失敗しました');
      return { success: false, normalizedCanonicalUrl: normalizedUrl };
    } finally {
      setIsSaving(false);
    }
  }, [canonicalUrl, form, onSubmit]);

  return {
    form,
    updateField,
    canonicalUrl,
    updateCanonicalUrl,
    canonicalUrlError,
    errorMessage,
    isSaving,
    saveDone,
    submit,
  };
}
