export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const Sentry = await import('@sentry/nextjs');
    
    const dsn = process.env.SENTRY_DSN;
    
    if (dsn) {
      Sentry.init({
        dsn,
        tracesSampleRate: 1,
        debug: false,
      });
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    const Sentry = await import('@sentry/nextjs');
    
    const dsn = process.env.SENTRY_DSN;
    
    if (dsn) {
      Sentry.init({
        dsn,
        tracesSampleRate: 1,
        debug: false,
      });
    }
  }
}