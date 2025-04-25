import { createClient } from 'next-sanity';

// Sanity クライアントの初期化
export const sanityClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: '2025-04-23',
  useCdn: true,
});
