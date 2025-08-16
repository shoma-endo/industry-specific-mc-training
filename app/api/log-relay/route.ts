import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/env';

export const runtime = 'nodejs';

interface LogEvent {
  level?: string;
  logLevel?: string;
  statusCode?: number;
  status?: number;
  message?: string;
  timestamp?: string;
  path?: string;
  http?: {
    response?: {
      status?: number;
    };
  };
  [key: string]: unknown;
}

async function readEvents(req: NextRequest): Promise<LogEvent[]> {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const json = await req.json().catch(() => null);
    if (!json) return [];
    return Array.isArray(json) ? (json as LogEvent[]) : [json as LogEvent];
  }
  const text = await req.text();
  return text
    .split(/\n+/)
    .map(l => l.trim())
    .filter(Boolean)
    .map((l): LogEvent => {
      try {
        return JSON.parse(l) as LogEvent;
      } catch {
        return { level: 'error', message: `Unparsable line: ${l}` };
      }
    });
}

function echoVercelHeadersInto(res: Headers, req: NextRequest) {
  for (const [k, v] of req.headers) {
    if (k.toLowerCase().startsWith('x-vercel-')) res.set(k, v);
  }
}

function unauthorized(message: string) {
  return new NextResponse(message, { status: 403 });
}

function getVercelVerificationHeader(req: NextRequest): [string, string] | null {
  // 1) Header-based verification (primary)
  for (const [k, v] of req.headers) {
    const name = k.toLowerCase();
    if (!name.startsWith('x-vercel-')) continue;
    if (name.includes('verify') || name.includes('verification') || name.includes('challenge')) {
      return [k, v];
    }
  }
  // 2) Query param fallback (defensive)
  try {
    const url = new URL(req.url);
    const qp = url.searchParams.get('x-vercel-verify') || url.searchParams.get('vercel-verify');
    if (qp) {
      return ['x-vercel-verify', qp];
    }
  } catch {}
  return null;
}

export async function POST(req: NextRequest) {
  const verification = getVercelVerificationHeader(req);
  if (verification) {
    const headers = new Headers();
    // 固定名で検証用トークンを返却
    headers.set('x-vercel-verify', verification[1]);
    // 他のx-vercel-*ヘッダーも全部エコー
    echoVercelHeadersInto(headers, req);
    return new NextResponse('OK', { status: 200, headers });
  }

  const FORWARD_URL = env.BASE_WEBHOOK_URL;
  const RELAY_BEARER = env.RELAY_BEARER_TOKEN;

  // 1) Bearer 認証（Log Drain の Custom Headers と一致が必須）
  const auth = req.headers.get('authorization') || '';
  if (RELAY_BEARER && auth !== `Bearer ${RELAY_BEARER}`) {
    const res = unauthorized('forbidden');
    echoVercelHeadersInto(res.headers, req); // 検証用途
    return res;
  }

  // 2) Vercel 検証互換: x-vercel-* をレスポンスへエコー
  const outHeaders = new Headers();
  echoVercelHeadersInto(outHeaders, req);

  if (!FORWARD_URL) {
    return new NextResponse('BASE_WEBHOOK_URL not set', { status: 500, headers: outHeaders });
  }

  // 3) 本文取得（JSON/NDJSON両対応）
  const events = await readEvents(req);

  // 4) フィルタ（error レベル or 5xx ステータス）
  const alerts = events.filter(e => {
    const level = String(e.level || e.logLevel || '').toLowerCase();
    const status = String(e.statusCode ?? e.status ?? e?.http?.response?.status ?? '');
    return level === 'error' || /^5\d\d$/.test(status);
  });

  // 5) Lark Base Webhook へ転送（配列のまま送る）
  if (alerts.length > 0) {
    await fetch(FORWARD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alerts),
    }).catch(() => {
      /* 転送失敗は握り潰し（Log Drain 側は 200 応答が求められる） */
    });
  }

  // 6) 常に 200（検証/本番共通）
  outHeaders.set('content-type', 'application/json');
  return new NextResponse(
    JSON.stringify({ ok: true, received: events.length, forwarded: alerts.length }),
    { status: 200, headers: outHeaders }
  );
}

export function GET(req: NextRequest) {
  const verification = getVercelVerificationHeader(req);
  if (verification) {
    const headers = new Headers();
    headers.set('x-vercel-verify', verification[1]);
    return new NextResponse('OK', { status: 200, headers });
  }
  // Endpoint availability check
  return new NextResponse(null, { status: 200 });
}

export function HEAD(req: NextRequest) {
  const verification = getVercelVerificationHeader(req);
  if (verification) {
    const headers = new Headers();
    headers.set('x-vercel-verify', verification[1]);
    return new NextResponse(null, { status: 200, headers });
  }
  // Endpoint availability check
  return new NextResponse(null, { status: 200 });
}

export function OPTIONS(req: NextRequest) {
  const verification = getVercelVerificationHeader(req);
  if (verification) {
    const headers = new Headers();
    headers.set('x-vercel-verify', verification[1]);
    return new NextResponse(null, { status: 200, headers });
  }
  // CORS preflight or availability check
  return new NextResponse(null, { status: 200 });
}
