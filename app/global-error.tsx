'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error occurred:', error);
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
