'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body style={{ padding: 24 }}>
        <h2>申し訳ありません。エラーが発生しました。</h2>
        <p>{error?.message}</p>
        <button onClick={() => reset()}>再試行</button>
      </body>
    </html>
  );
}