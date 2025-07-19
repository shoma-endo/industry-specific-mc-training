// src/env.mjs
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  /*
   * Serverside Environment variables, not available on the client.
   * Will throw if you access these variables on the client.
   */
  server: {
    DBPASS: z.string().min(1),
    SUPABASE_SERVICE_ROLE: z.string().min(1),
    STRIPE_SECRET_KEY: z.string().min(1),
    STRIPE_PUBLISHABLE_KEY: z.string().min(1),
    STRIPE_PRODUCT_ID: z.string().min(1),
    STRIPE_PRICE_ID: z.string().min(1),
    OPENAI_API_KEY: z.string().min(1),
    ANTHROPIC_API_KEY: z.string().min(1),
    GOOGLE_CUSTOM_SEARCH_KEY: z.string().min(1),
    GOOGLE_CSE_ID: z.string().min(1),
    SANITY_STUDIO_READ_TOKEN: z.string().min(1),
    SANITY_WEBHOOK_SECRET: z.string().min(1),
    LINE_CHANNEL_ID: z.string().min(1),
    LINE_CHANNEL_SECRET: z.string().min(1),
  },
  /*
   * Environment variables available on the client (and server).
   *
   * 💡 You'll get type errors if these are not prefixed with NEXT_PUBLIC_.
   */
  client: {
    NEXT_PUBLIC_LIFF_ID: z.string().min(1),
    NEXT_PUBLIC_LIFF_CHANNEL_ID: z.string().min(1),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_SANITY_PROJECT_ID: z.string().min(1),
    NEXT_PUBLIC_SANITY_DATASET: z.string().min(1),
    NEXT_PUBLIC_SITE_URL: z.string().url(),
  },
  /*
   * Due to how Next.js bundles environment variables on Edge and Client,
   * we need to manually destructure them to make sure all are included in bundle.
   *
   * 💡 You'll get type errors if not all variables from `server` & `client` are included here.
   */
  runtimeEnv: {
    NEXT_PUBLIC_LIFF_ID: process.env.NEXT_PUBLIC_LIFF_ID,
    NEXT_PUBLIC_LIFF_CHANNEL_ID: process.env.NEXT_PUBLIC_LIFF_CHANNEL_ID,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SANITY_PROJECT_ID: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    NEXT_PUBLIC_SANITY_DATASET: process.env.NEXT_PUBLIC_SANITY_DATASET,
    SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
    STRIPE_PRODUCT_ID: process.env.STRIPE_PRODUCT_ID,
    STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GOOGLE_CUSTOM_SEARCH_KEY: process.env.GOOGLE_CUSTOM_SEARCH_KEY,
    GOOGLE_CSE_ID: process.env.GOOGLE_CSE_ID,
    SANITY_STUDIO_READ_TOKEN: process.env.SANITY_STUDIO_READ_TOKEN,
    SANITY_WEBHOOK_SECRET: process.env.SANITY_WEBHOOK_SECRET,
    DBPASS: process.env.DBPASS,
    LINE_CHANNEL_ID: process.env.LINE_CHANNEL_ID,
    LINE_CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
});
