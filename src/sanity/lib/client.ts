import { createClient } from 'next-sanity';

// Sanity クライアントの初期化
export const sanityClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: '2025-04-23',
  useCdn: true,
});

export function createUserSanityClient(projectId: string, dataset: string) {
  return createClient({
    projectId,
    dataset,
    apiVersion: '2025-04-23',
    useCdn: false,
  });
}

// Draft Mode対応のクライアント作成関数
export function createDraftModeClient(projectId: string, dataset: string, token?: string) {
  const clientToken = token || process.env.SANITY_STUDIO_READ_TOKEN;

  if (!clientToken) {
    throw new Error('SANITY_STUDIO_READ_TOKEN is required for draft mode');
  }

  return createClient({
    projectId,
    dataset,
    apiVersion: '2025-04-23',
    useCdn: false,
    perspective: 'previewDrafts',
    token: clientToken,
  });
}
