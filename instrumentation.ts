export function onRequestError(err: unknown, request: unknown, context: unknown) {
  import('@sentry/nextjs')
    .then(Sentry => {
      type CaptureRequestError = typeof Sentry.captureRequestError;
      type RequestParam = Parameters<CaptureRequestError>[1];
      type ContextParam = Parameters<CaptureRequestError>[2];

      Sentry.captureRequestError(err, request as RequestParam, context as ContextParam);
    });
}
