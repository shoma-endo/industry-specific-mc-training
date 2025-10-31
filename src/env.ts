import { z } from 'zod';

const clientEnvSchema = z.object({
  NEXT_PUBLIC_LIFF_ID: z.string().min(1),
  NEXT_PUBLIC_LIFF_CHANNEL_ID: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_STRIPE_ENABLED: z.string().default('false'),
});

const serverEnvSchema = z.object({
  DBPASS: z.string().min(1),
  SUPABASE_SERVICE_ROLE: z.string().min(1),
  STRIPE_ENABLED: z.string().default('false'),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_PRICE_ID: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  LINE_CHANNEL_ID: z.string().min(1),
  LINE_CHANNEL_SECRET: z.string().min(1),
  BASE_WEBHOOK_URL: z.string().url(),
  RELAY_BEARER_TOKEN: z.string().min(1),
});

type ClientEnv = z.infer<typeof clientEnvSchema>;
type ServerEnv = z.infer<typeof serverEnvSchema>;
export type Env = ClientEnv & ServerEnv;

const isServer = typeof window === 'undefined';

const clientRuntimeEnv = {
  NEXT_PUBLIC_LIFF_ID: process.env.NEXT_PUBLIC_LIFF_ID,
  NEXT_PUBLIC_LIFF_CHANNEL_ID: process.env.NEXT_PUBLIC_LIFF_CHANNEL_ID,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_STRIPE_ENABLED: process.env.NEXT_PUBLIC_STRIPE_ENABLED ?? process.env.STRIPE_ENABLED,
} satisfies { [K in keyof ClientEnv]?: ClientEnv[K] | undefined };

const parsedClientEnv = clientEnvSchema.parse(clientRuntimeEnv);

let parsedServerEnv: ServerEnv | undefined;
if (isServer) {
  const serverRuntimeEnv = {
    DBPASS: process.env.DBPASS,
    SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE,
    STRIPE_ENABLED: process.env.STRIPE_ENABLED,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    LINE_CHANNEL_ID: process.env.LINE_CHANNEL_ID,
    LINE_CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET,
    BASE_WEBHOOK_URL: process.env.BASE_WEBHOOK_URL,
    RELAY_BEARER_TOKEN: process.env.RELAY_BEARER_TOKEN,
  } satisfies { [K in keyof ServerEnv]?: ServerEnv[K] | undefined };

  parsedServerEnv = serverEnvSchema.parse(serverRuntimeEnv);
}

const serverOnlyKeys = new Set<keyof ServerEnv>([
  'DBPASS',
  'SUPABASE_SERVICE_ROLE',
  'STRIPE_ENABLED',
  'STRIPE_SECRET_KEY',
  'STRIPE_PRICE_ID',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'LINE_CHANNEL_ID',
  'LINE_CHANNEL_SECRET',
  'BASE_WEBHOOK_URL',
  'RELAY_BEARER_TOKEN',
]);

const clientKeys = new Set<keyof ClientEnv>([
  'NEXT_PUBLIC_LIFF_ID',
  'NEXT_PUBLIC_LIFF_CHANNEL_ID',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_STRIPE_ENABLED',
]);

const envProxy = new Proxy({} as Env, {
  get: (_target, prop) => {
    if (typeof prop !== 'string') {
      if (prop === Symbol.toStringTag) {
        return 'Env';
      }
      return undefined;
    }

    if (clientKeys.has(prop as keyof ClientEnv)) {
      return parsedClientEnv[prop as keyof ClientEnv];
    }

    if (serverOnlyKeys.has(prop as keyof ServerEnv)) {
      if (!isServer) {
        throw new Error(`サーバー専用環境変数 ${prop} をクライアントから参照できません`);
      }
      if (!parsedServerEnv) {
        throw new Error('サーバー環境変数の初期化に失敗しました');
      }
      return parsedServerEnv[prop as keyof ServerEnv];
    }

    throw new Error(`環境変数 ${String(prop)} はスキーマに存在しません`);
  },
  has: (_target, prop) => {
    if (typeof prop !== 'string') {
      return false;
    }
    if (clientKeys.has(prop as keyof ClientEnv)) {
      return true;
    }
    return isServer && serverOnlyKeys.has(prop as keyof ServerEnv);
  },
  ownKeys: () => [
    ...Array.from(clientKeys.values()),
    ...(isServer && parsedServerEnv ? Object.keys(parsedServerEnv) : []),
  ],
  getOwnPropertyDescriptor: (_target, prop) => {
    if (typeof prop !== 'string') {
      return undefined;
    }
    if (clientKeys.has(prop as keyof ClientEnv) || (isServer && serverOnlyKeys.has(prop as keyof ServerEnv))) {
      return { enumerable: true, configurable: false };
    }
    return undefined;
  },
});

export const env = envProxy;
export const clientEnv = parsedClientEnv;
export const runtimeEnv: Partial<Env> = {
  ...parsedClientEnv,
  ...(isServer && parsedServerEnv ? parsedServerEnv : {}),
};
